import type { TelemetryEvent } from "../../../../types";
import type { Logger } from "../../../../types/Logger";
import type { NetworkEventPayload } from "../../types/NetworkEvent";
import { isStreamingResponse } from "../streamingDetection";
import { extractQueryParams } from "../extractQueryParams";
import { extractResponseHeaders } from "../extractResponseHeaders";
import { extractResponseBody } from "../extractResponseBody";
import {
  interceptStreamingResponse,
  interceptGenericStreamingResponse,
} from "../sseInterceptor";
import { normalizeUrl } from "../normalizeUrl";

export interface FetchInterceptorOptions {
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void;
  shouldCaptureRequest?: (url: string) => boolean;
  telemetryEndpoint?: string;
  logger?: Logger;
}

export function patchFetch({
  handleTelemetryEvent,
  shouldCaptureRequest,
  telemetryEndpoint,
  logger,
}: FetchInterceptorOptions): () => void {
  if (typeof window === "undefined" || typeof window.fetch === "undefined") {
    throw new Error(
      "patchFetch can only be used in a browser environment with window.fetch available"
    );
  }
  const originalFetch = window.fetch;

  const defaultShouldCapture = (url: string) => {
    // Default: filter out telemetry endpoint and Hyperlook
    if (telemetryEndpoint && url.includes(telemetryEndpoint)) return false;
    if (url.includes("hyperlook")) return false;
    return true;
  };

  const captureCheck = shouldCaptureRequest || defaultShouldCapture;

  const interceptor = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startTime = performance.now();
    let url: string;
    if (typeof input === "string") {
      url = normalizeUrl(input);
    } else if (input instanceof URL) {
      url = normalizeUrl(input);
    } else if (typeof (input as { url?: string }).url === "string") {
      url = normalizeUrl((input as { url: string }).url);
    } else {
      url = JSON.stringify(input);
    }
    const method = init?.method || "GET";

    if (!captureCheck(url)) {
      return originalFetch.call(window, input, init);
    }

    try {
      const response = await originalFetch.call(window, input, init);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Check if this is a streaming response
      const isStreaming = isStreamingResponse(response);
      const contentType = response.headers.get("content-type") || "";
      const isSSE = contentType.includes("text/event-stream");

      if (isStreaming || isSSE) {
        // For streaming responses, set up streaming interception
        // CRITICAL: Don't clone the response if it's streaming - create a tee instead
        let streamingResponse: Response;
        let originalResponse: Response;

        if (response.body && !response.bodyUsed) {
          try {
            // Use tee() to split the stream into two readable streams
            const [stream1, stream2] = response.body.tee();

            // Create new responses from the teed streams
            streamingResponse = new Response(stream1, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });

            originalResponse = new Response(stream2, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch (error) {
            logger?.warn(
              "Failed to tee streaming response, falling back to clone",
              {
                error: error instanceof Error ? error.message : String(error),
                url,
              }
            );
            // Fallback to cloning if tee fails
            try {
              streamingResponse = response.clone();
              originalResponse = response;
            } catch (cloneError) {
              logger?.error(
                "Failed to clone streaming response, skipping stream interception",
                {
                  error:
                    cloneError instanceof Error
                      ? cloneError.message
                      : String(cloneError),
                  url,
                }
              );
              // If both tee and clone fail, just use the original response
              streamingResponse = response;
              originalResponse = response;
            }
          }
        } else {
          // If no body or already used, just use the original
          streamingResponse = response;
          originalResponse = response;
        }

        // Set up streaming interception on the dedicated stream
        if ((isStreaming || isSSE) && streamingResponse !== originalResponse) {
          try {
            if (isSSE) {
              // Use SSE-specific interception for text/event-stream
              interceptStreamingResponse(
                streamingResponse,
                url,
                startTime,
                handleTelemetryEvent,
                logger
              );
            } else {
              // For other streaming responses, set up generic streaming interception
              interceptGenericStreamingResponse(
                streamingResponse,
                url,
                startTime,
                handleTelemetryEvent,
                logger
              );
            }
          } catch (error) {
            logger?.error("Failed to set up streaming interception", {
              error: error instanceof Error ? error.message : String(error),
              url,
              isSSE,
              isStreaming,
            });
          }
        }

        // Capture the initial connection event
        const event: TelemetryEvent<NetworkEventPayload> = {
          eventType: url.includes("supabase") ? "supabase" : "network",
          eventName: url.includes("supabase")
            ? isSSE
              ? "supabase_fetch_sse_initiated"
              : "supabase_fetch_streaming"
            : isSSE
              ? "fetch_sse_initiated"
              : "fetch_streaming",
          payload: {
            url,
            method,
            queryParams: extractQueryParams(url),
            responseStatus: response.status,
            responseStatusText: response.statusText,
            responseHeaders: extractResponseHeaders(response),
            duration,
            startTime,
            endTime,
            isSupabaseQuery: url.includes("supabase"),
            isStreaming: true,
            isKeepAlive:
              response.headers
                .get("connection")
                ?.toLowerCase()
                .includes("keep-alive") || false,
            ...(isSSE && { sseState: "connected" as const }),
          },
          timestamp: new Date().toISOString(),
        };

        try {
          handleTelemetryEvent(event);
        } catch (err) {
          logger?.error("Telemetry handler error in fetch streaming", {
            error: err,
          });
        }

        // Return the original response (or the one with the original stream)
        return originalResponse;
      }

      // For non-streaming responses, handle normally
      let responseBody: unknown = undefined;
      let responseClone: Response | null = null;

      // Only extract body for non-streaming responses and if response is not already consumed
      if (!response.bodyUsed && !isStreaming) {
        try {
          responseClone = response.clone();
          responseBody = await extractResponseBody(responseClone);
        } catch (error) {
          // If cloning/reading fails, continue without body data
          logger?.warn("Failed to extract response body", { error });
          responseBody = null;
        }
      }

      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: url.includes("supabase") ? "supabase" : "network",
        eventName: url.includes("supabase")
          ? "supabase_fetch_complete"
          : "fetch_complete",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: extractResponseHeaders(response),
          responseBody,
          duration,
          startTime,
          endTime,
          isSupabaseQuery: url.includes("supabase"),
          isStreaming: false,
          isKeepAlive:
            response.headers
              .get("connection")
              ?.toLowerCase()
              .includes("keep-alive") || false,
        },
        timestamp: new Date().toISOString(),
      };

      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in fetch", { error: err });
        // Don't throw here to avoid breaking the original request
      }

      // Return the original response (not the clone)
      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: url.includes("supabase") ? "supabase" : "network",
        eventName: url.includes("supabase")
          ? "supabase_fetch_error"
          : "fetch_error",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          error: error instanceof Error ? error.message : String(error),
          duration,
          startTime,
          endTime,
          isSupabaseQuery: url.includes("supabase"),
        },
        timestamp: new Date().toISOString(),
      };
      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in fetch (error case)", {
          error: err,
        });
        // Don't throw here to avoid masking the original error
      }
      throw error;
    }
  };

  // Patch fetch
  window.fetch = interceptor as typeof fetch;

  // Return unpatch function
  return () => {
    window.fetch = originalFetch;
  };
}
