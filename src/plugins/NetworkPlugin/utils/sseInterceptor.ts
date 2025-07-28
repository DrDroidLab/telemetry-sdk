import type { TelemetryEvent } from "../../../types";
import type { Logger } from "../../../types/Logger";
import type { NetworkEventPayload } from "../types/NetworkEvent";
import { normalizeUrl } from "./normalizeUrl";

export interface SSEInterceptorOptions {
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void;
  shouldCaptureRequest?: (url: string) => boolean;
  telemetryEndpoint?: string;
  logger?: Logger;
  maxMessageSize?: number;
  maxMessagesPerConnection?: number;
  captureStreamingMessages?: boolean;
}

interface SSEConnectionState {
  url: string;
  startTime: number;
  messageCount: number;
  lastEventId?: string;
  readyState: number;
  connectionId: string;
}

export function patchEventSource({
  handleTelemetryEvent,
  shouldCaptureRequest,
  telemetryEndpoint,
  logger,
  maxMessageSize = 10000, // 10KB per message
  maxMessagesPerConnection = 1000, // Max messages to capture per connection
  captureStreamingMessages = false,
}: SSEInterceptorOptions): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.EventSource === "undefined"
  ) {
    logger?.warn("EventSource not available in this environment");
    return () => {};
  }

  const originalEventSource = window.EventSource;
  const activeConnections = new Map<EventSource, SSEConnectionState>();

  const defaultShouldCapture = (url: string) => {
    if (telemetryEndpoint && url.includes(telemetryEndpoint)) return false;
    if (url.includes("hyperlook")) return false;
    return true;
  };

  const captureCheck = shouldCaptureRequest || defaultShouldCapture;

  class InterceptedEventSource extends originalEventSource {
    constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
      const urlString = normalizeUrl(url);

      super(url, eventSourceInitDict);

      if (!captureCheck(urlString)) {
        return;
      }

      const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = performance.now();

      // Track connection state
      const connectionState: SSEConnectionState = {
        url: urlString,
        startTime,
        messageCount: 0,
        readyState: this.readyState,
        connectionId,
      };

      activeConnections.set(this, connectionState);

      // Capture connection opened
      this.addEventListener("open", () => {
        connectionState.readyState = this.readyState;
        const event: TelemetryEvent<NetworkEventPayload> = {
          eventType: "network",
          eventName: "sse_connection_opened",
          payload: {
            url: urlString,
            method: "GET",
            responseStatus: 200,
            responseStatusText: "OK",
            duration: performance.now() - startTime,
            startTime,
            endTime: performance.now(),
            isSupabaseQuery: urlString.includes("supabase"),
            isStreaming: true,
            isKeepAlive: true,
            connectionId,
            sseState: "connected",
          },
          timestamp: new Date().toISOString(),
        };

        try {
          handleTelemetryEvent(event);
        } catch (err) {
          logger?.error("Error handling SSE connection opened event", {
            error: err,
          });
        }
      });

      // Capture individual messages only if enabled
      if (captureStreamingMessages) {
        this.addEventListener("message", messageEvent => {
          if (connectionState.messageCount >= maxMessagesPerConnection) {
            return; // Stop capturing after max messages
          }

          connectionState.messageCount++;
          connectionState.lastEventId = messageEvent.lastEventId;

          let messageData: unknown = messageEvent.data;

          // Try to parse JSON data
          if (typeof messageEvent.data === "string") {
            try {
              messageData = JSON.parse(messageEvent.data);
            } catch {
              // Keep as string if not JSON
              messageData = messageEvent.data;
            }
          }

          // Truncate large messages
          if (
            typeof messageData === "string" &&
            messageData.length > maxMessageSize
          ) {
            messageData =
              messageData.substring(0, maxMessageSize) + "... [truncated]";
          }

          const event: TelemetryEvent<NetworkEventPayload> = {
            eventType: "network",
            eventName: "sse_message_received",
            payload: {
              url: urlString,
              method: "GET",
              responseStatus: 200,
              responseStatusText: "OK",
              responseBody: messageData,
              duration: performance.now() - startTime,
              startTime,
              endTime: performance.now(),
              isSupabaseQuery: urlString.includes("supabase"),
              isStreaming: true,
              isKeepAlive: true,
              connectionId,
              sseState: "message",
              sseMessageId: messageEvent.lastEventId,
              sseMessageType: messageEvent.type,
              sseMessageCount: connectionState.messageCount,
            },
            timestamp: new Date().toISOString(),
          };

          try {
            handleTelemetryEvent(event);
          } catch (err) {
            logger?.error("Error handling SSE message event", { error: err });
          }
        });
      }

      // Capture connection errors
      this.addEventListener("error", () => {
        connectionState.readyState = this.readyState;
        const event: TelemetryEvent<NetworkEventPayload> = {
          eventType: "network",
          eventName: "sse_connection_error",
          payload: {
            url: urlString,
            method: "GET",
            error: "SSE connection error",
            duration: performance.now() - startTime,
            startTime,
            endTime: performance.now(),
            isSupabaseQuery: urlString.includes("supabase"),
            isStreaming: true,
            isKeepAlive: false,
            connectionId,
            sseState: "error",
            sseMessageCount: connectionState.messageCount,
          },
          timestamp: new Date().toISOString(),
        };

        try {
          handleTelemetryEvent(event);
        } catch (err) {
          logger?.error("Error handling SSE error event", { error: err });
        }

        // Clean up connection state
        activeConnections.delete(this);
      });

      // Handle connection close
      const originalClose = this.close.bind(this);
      this.close = () => {
        const event: TelemetryEvent<NetworkEventPayload> = {
          eventType: "network",
          eventName: "sse_connection_closed",
          payload: {
            url: urlString,
            method: "GET",
            duration: performance.now() - startTime,
            startTime,
            endTime: performance.now(),
            isSupabaseQuery: urlString.includes("supabase"),
            isStreaming: true,
            isKeepAlive: false,
            connectionId,
            sseState: "closed",
            sseMessageCount: connectionState.messageCount,
          },
          timestamp: new Date().toISOString(),
        };

        try {
          handleTelemetryEvent(event);
        } catch (err) {
          logger?.error("Error handling SSE close event", { error: err });
        }

        activeConnections.delete(this);
        originalClose();
      };
    }
  }

  // Replace the global EventSource
  Object.defineProperty(window, "EventSource", {
    value: InterceptedEventSource,
    writable: true,
    configurable: true,
  });

  // Return cleanup function
  return () => {
    Object.defineProperty(window, "EventSource", {
      value: originalEventSource,
      writable: true,
      configurable: true,
    });
    activeConnections.clear();
  };
}

/**
 * Enhanced streaming detection for fetch responses that might be SSE
 */
export function interceptStreamingResponse(
  response: Response,
  url: string,
  startTime: number,
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void,
  logger?: Logger,
  captureStreamingMessages: boolean = false
): void {
  const normalizedUrl = normalizeUrl(url);

  if (!response.body || response.bodyUsed) {
    logger?.warn(
      "Cannot intercept streaming response: body is null or already used"
    );
    return;
  }

  const contentType = response.headers.get("content-type") || "";

  // Only intercept text/event-stream responses
  if (!contentType.includes("text/event-stream")) {
    logger?.debug("Skipping non-SSE response for streaming interception", {
      contentType,
    });
    return;
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let messageCount = 0;
    let buffer = "";
    const connectionId = `fetch_sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Capture SSE connection start
    const connectionEvent: TelemetryEvent<NetworkEventPayload> = {
      eventType: "network",
      eventName: "sse_fetch_stream_started",
      payload: {
        url: normalizedUrl,
        method: "GET",
        responseStatus: response.status,
        responseStatusText: response.statusText,
        duration: performance.now() - startTime,
        startTime,
        endTime: performance.now(),
        isSupabaseQuery: normalizedUrl.includes("supabase"),
        isStreaming: true,
        isKeepAlive: true,
        connectionId,
        sseState: "connected",
      },
      timestamp: new Date().toISOString(),
    };

    try {
      handleTelemetryEvent(connectionEvent);
    } catch (err) {
      logger?.error("Error handling SSE connection start event", {
        error: err,
      });
    }

    // Only process individual messages if enabled
    if (!captureStreamingMessages) {
      // Just capture start/end events, not individual messages
      reader.releaseLock();
      return;
    }

    // Read the stream and process messages
    const readStream = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream ended - process any remaining buffer
            if (buffer.trim()) {
              processSSEBuffer(
                buffer,
                messageCount,
                normalizedUrl,
                startTime,
                connectionId,
                handleTelemetryEvent,
                logger
              );
            }

            // Send stream end event
            const endEvent: TelemetryEvent<NetworkEventPayload> = {
              eventType: "network",
              eventName: "sse_fetch_stream_ended",
              payload: {
                url: normalizedUrl,
                method: "GET",
                duration: performance.now() - startTime,
                startTime,
                endTime: performance.now(),
                isSupabaseQuery: normalizedUrl.includes("supabase"),
                isStreaming: true,
                isKeepAlive: false,
                connectionId,
                sseState: "closed",
                sseMessageCount: messageCount,
              },
              timestamp: new Date().toISOString(),
            };

            try {
              handleTelemetryEvent(endEvent);
            } catch (err) {
              logger?.error("Error handling SSE stream end event", {
                error: err,
              });
            }
            return;
          }

          // Process the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete SSE messages in the buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

          let currentMessage = "";
          for (const line of lines) {
            if (line.trim() === "") {
              // Empty line indicates end of message
              if (currentMessage.trim()) {
                const processedCount = processSSEMessage(
                  currentMessage,
                  messageCount,
                  normalizedUrl,
                  startTime,
                  connectionId,
                  response,
                  handleTelemetryEvent,
                  logger
                );
                if (processedCount > messageCount) {
                  messageCount = processedCount;
                }
                currentMessage = "";
              }
            } else {
              currentMessage += line + "\n";
            }
          }

          // If we have a partial message, add it back to current message
          if (buffer.trim()) {
            currentMessage += buffer;
            buffer = "";
          }
        }
      } catch (error) {
        const errorEvent: TelemetryEvent<NetworkEventPayload> = {
          eventType: "network",
          eventName: "sse_fetch_stream_error",
          payload: {
            url: normalizedUrl,
            method: "GET",
            error: error instanceof Error ? error.message : String(error),
            duration: performance.now() - startTime,
            startTime,
            endTime: performance.now(),
            isSupabaseQuery: normalizedUrl.includes("supabase"),
            isStreaming: true,
            isKeepAlive: false,
            connectionId,
            sseState: "error",
            sseMessageCount: messageCount,
          },
          timestamp: new Date().toISOString(),
        };

        try {
          handleTelemetryEvent(errorEvent);
        } catch (err) {
          logger?.error("Error handling SSE stream error event", {
            error: err,
          });
        }
      } finally {
        // Clean up reader
        try {
          reader.releaseLock();
        } catch (err) {
          logger?.debug("Error releasing reader lock", { error: err });
        }
      }
    };

    // Start reading the stream (don't await to avoid blocking)
    readStream().catch(error => {
      logger?.error("Error reading SSE stream", { error });
    });
  } catch (error) {
    logger?.error("Error setting up SSE stream interception", { error });
  }
}

/**
 * Generic streaming response interceptor for non-SSE streaming responses
 */
export function interceptGenericStreamingResponse(
  response: Response,
  url: string,
  startTime: number,
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void,
  logger?: Logger,
  captureStreamingMessages: boolean = false
): void {
  const normalizedUrl = normalizeUrl(url);

  if (!response.body || response.bodyUsed) {
    logger?.warn(
      "Cannot intercept generic streaming response: body is null or already used"
    );
    return;
  }

  const contentType = response.headers.get("content-type") || "";

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    const connectionId = `fetch_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const maxChunks = 100; // Limit chunks to prevent overwhelming telemetry
    const maxChunkSize = 5000; // 5KB per chunk

    // Capture streaming connection start
    const connectionEvent: TelemetryEvent<NetworkEventPayload> = {
      eventType: "network",
      eventName: "fetch_stream_started",
      payload: {
        url: normalizedUrl,
        method: "GET",
        responseStatus: response.status,
        responseStatusText: response.statusText,
        duration: performance.now() - startTime,
        startTime,
        endTime: performance.now(),
        isSupabaseQuery: normalizedUrl.includes("supabase"),
        isStreaming: true,
        isKeepAlive: true,
        connectionId,
        streamContentType: contentType,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      handleTelemetryEvent(connectionEvent);
    } catch (err) {
      logger?.error("Error handling streaming connection start event", {
        error: err,
      });
    }

    // Only process individual chunks if enabled
    if (!captureStreamingMessages) {
      // Just capture start/end events, not individual chunks
      reader.releaseLock();
      return;
    }

    // Read the stream and process chunks
    const readStream = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Send stream end event
            const endEvent: TelemetryEvent<NetworkEventPayload> = {
              eventType: "network",
              eventName: "fetch_stream_ended",
              payload: {
                url: normalizedUrl,
                method: "GET",
                duration: performance.now() - startTime,
                startTime,
                endTime: performance.now(),
                isSupabaseQuery: normalizedUrl.includes("supabase"),
                isStreaming: true,
                isKeepAlive: false,
                connectionId,
                streamChunkCount: chunkCount,
              },
              timestamp: new Date().toISOString(),
            };

            try {
              handleTelemetryEvent(endEvent);
            } catch (err) {
              logger?.error("Error handling streaming end event", {
                error: err,
              });
            }
            return;
          }

          // Stop capturing after max chunks to prevent overwhelming telemetry
          if (chunkCount >= maxChunks) {
            logger?.debug("Reached max chunk limit for streaming response", {
              url: normalizedUrl,
              chunkCount,
            });
            continue;
          }

          chunkCount++;

          // Process the chunk
          const chunk = decoder.decode(value, { stream: true });

          // Truncate large chunks
          let chunkData: string = chunk;
          if (chunk.length > maxChunkSize) {
            chunkData = chunk.substring(0, maxChunkSize) + "... [truncated]";
          }

          // Try to parse as JSON if possible
          let parsedChunk: unknown = chunkData;
          try {
            // Only try to parse if it looks like JSON
            if (
              chunkData.trim().startsWith("{") ||
              chunkData.trim().startsWith("[")
            ) {
              parsedChunk = JSON.parse(chunkData);
            }
          } catch {
            // Keep as string if not JSON
          }

          const chunkEvent: TelemetryEvent<NetworkEventPayload> = {
            eventType: "network",
            eventName: "fetch_stream_chunk_received",
            payload: {
              url: normalizedUrl,
              method: "GET",
              responseStatus: response.status,
              responseStatusText: response.statusText,
              responseBody: parsedChunk,
              duration: performance.now() - startTime,
              startTime,
              endTime: performance.now(),
              isSupabaseQuery: normalizedUrl.includes("supabase"),
              isStreaming: true,
              isKeepAlive: true,
              connectionId,
              streamChunkCount: chunkCount,
              streamChunkSize: chunk.length,
            },
            timestamp: new Date().toISOString(),
          };

          try {
            handleTelemetryEvent(chunkEvent);
          } catch (err) {
            logger?.error("Error handling streaming chunk event", {
              error: err,
            });
          }
        }
      } catch (error) {
        const errorEvent: TelemetryEvent<NetworkEventPayload> = {
          eventType: "network",
          eventName: "fetch_stream_error",
          payload: {
            url: normalizedUrl,
            method: "GET",
            error: error instanceof Error ? error.message : String(error),
            duration: performance.now() - startTime,
            startTime,
            endTime: performance.now(),
            isSupabaseQuery: normalizedUrl.includes("supabase"),
            isStreaming: true,
            isKeepAlive: false,
            connectionId,
            streamChunkCount: chunkCount,
          },
          timestamp: new Date().toISOString(),
        };

        try {
          handleTelemetryEvent(errorEvent);
        } catch (err) {
          logger?.error("Error handling streaming error event", {
            error: err,
          });
        }
      } finally {
        // Clean up reader
        try {
          reader.releaseLock();
        } catch (err) {
          logger?.debug("Error releasing reader lock", { error: err });
        }
      }
    };

    // Start reading the stream (don't await to avoid blocking)
    readStream().catch(error => {
      logger?.error("Error reading generic stream", { error });
    });
  } catch (error) {
    logger?.error("Error setting up generic stream interception", { error });
  }
}

/**
 * Process a complete SSE message
 */
function processSSEMessage(
  message: string,
  currentCount: number,
  url: string,
  startTime: number,
  connectionId: string,
  response: Response,
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void,
  logger?: Logger
): number {
  const normalizedUrl = normalizeUrl(url);
  const lines = message.trim().split("\n");
  let data = "";
  let eventType = "message";
  let id = "";

  // Parse SSE message format
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      data += line.substring(6) + "\n";
    } else if (line.startsWith("event: ")) {
      eventType = line.substring(7);
    } else if (line.startsWith("id: ")) {
      id = line.substring(4);
    }
  }

  // Remove trailing newline from data
  data = data.replace(/\n$/, "");

  if (data) {
    const messageCount = currentCount + 1;

    let parsedData: unknown = data;
    try {
      parsedData = JSON.parse(data);
    } catch {
      // Keep as string if not JSON
    }

    const messageEvent: TelemetryEvent<NetworkEventPayload> = {
      eventType: "network",
      eventName: "sse_fetch_message_received",
      payload: {
        url: normalizedUrl,
        method: "GET",
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseBody: parsedData,
        duration: performance.now() - startTime,
        startTime,
        endTime: performance.now(),
        isSupabaseQuery: normalizedUrl.includes("supabase"),
        isStreaming: true,
        isKeepAlive: true,
        connectionId,
        sseState: "message",
        ...(id && { sseMessageId: id }),
        sseMessageType: eventType,
        sseMessageCount: messageCount,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      handleTelemetryEvent(messageEvent);
    } catch (err) {
      logger?.error("Error handling SSE message event", { error: err });
    }

    return messageCount;
  }

  return currentCount;
}

/**
 * Process remaining buffer content
 */
function processSSEBuffer(
  buffer: string,
  currentCount: number,
  url: string,
  startTime: number,
  connectionId: string,
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void,
  logger?: Logger
): void {
  const normalizedUrl = normalizeUrl(url);
  // Process any remaining complete messages in buffer
  const messages = buffer.split("\n\n");
  for (const message of messages) {
    if (message.trim()) {
      processSSEMessage(
        message,
        currentCount,
        normalizedUrl,
        startTime,
        connectionId,
        // Create a mock response for buffer processing
        new Response(null, { status: 200, statusText: "OK" }),
        handleTelemetryEvent,
        logger
      );
    }
  }
}
