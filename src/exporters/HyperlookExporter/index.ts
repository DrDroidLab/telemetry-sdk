import type { TelemetryExporter, TelemetryEvent } from "../../types";
import { getLogger } from "../../logger";
import { HYPERLOOK_URL } from "../../constants";
import { transformEvent } from "./utils";
import { getCurrentVersion } from "../../utils/versionUtils";
import type { EnhancedError } from "../../TelemetryManager/types";

interface HyperlookPayload {
  events: Array<{
    event_type: string;
    event_name: string;
    [key: string]: unknown;
  }>;
}

export class HyperlookExporter implements TelemetryExporter {
  private logger = getLogger();
  private apiKey: string;
  private connectionTimeout: number;
  private requestTimeout: number;
  private maxBatchSize: number;
  private maxPayloadSize: number;

  constructor(
    apiKey: string,
    connectionTimeout: number = 10000, // 10 seconds for connection
    requestTimeout: number = 45000, // 45 seconds for request (increased from 30)
    maxBatchSize: number = 100, // Maximum events per batch
    maxPayloadSize: number = 5 * 1024 * 1024 // 5MB max payload size
  ) {
    // Validate parameters
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("apiKey is required and must be a string");
    }
    if (connectionTimeout < 0) {
      throw new Error("connectionTimeout must be non-negative");
    }
    if (requestTimeout < 0) {
      throw new Error("requestTimeout must be non-negative");
    }
    if (connectionTimeout > requestTimeout) {
      throw new Error(
        "connectionTimeout cannot be greater than requestTimeout"
      );
    }
    if (maxBatchSize < 1) {
      throw new Error("maxBatchSize must be at least 1");
    }
    if (maxPayloadSize < 1024) {
      throw new Error("maxPayloadSize must be at least 1KB");
    }

    this.apiKey = apiKey;
    this.connectionTimeout = connectionTimeout;
    this.requestTimeout = requestTimeout;
    this.maxBatchSize = maxBatchSize;
    this.maxPayloadSize = maxPayloadSize;
    this.logger.debug("HyperlookExporter initialized", {
      endpoint: HYPERLOOK_URL,
      connectionTimeout,
      requestTimeout,
      maxBatchSize,
      maxPayloadSize,
    });
  }

  getEndpoint(): string | undefined {
    return HYPERLOOK_URL;
  }

  transformPayload(events: TelemetryEvent[], forBeacon?: boolean): unknown {
    // Transform events to Hyperlook format
    const hyperlookEvents = events
      .map(event => {
        try {
          return transformEvent(event);
        } catch {
          return null;
        }
      })
      .filter((event): event is NonNullable<typeof event> => event !== null);

    const payload: { events: HyperlookPayload["events"]; api_key?: string } = {
      events: hyperlookEvents,
    };

    // For beacon requests, include API key in body since headers aren't supported
    if (forBeacon) {
      payload.api_key = this.apiKey;
    }

    return payload;
  }

  private validateAndSplitBatch(events: TelemetryEvent[]): TelemetryEvent[][] {
    if (events.length <= this.maxBatchSize) {
      return [events];
    }

    // Split into smaller batches
    const batches: TelemetryEvent[][] = [];
    for (let i = 0; i < events.length; i += this.maxBatchSize) {
      batches.push(events.slice(i, i + this.maxBatchSize));
    }

    this.logger.debug("Events split into multiple batches", {
      originalCount: events.length,
      batchCount: batches.length,
      maxBatchSize: this.maxBatchSize,
    });

    return batches;
  }

  private validatePayload(payload: HyperlookPayload): {
    isValid: boolean;
    error?: string;
  } {
    try {
      const payloadString = JSON.stringify(payload);

      // Check if this payload contains session replay events
      const hasSessionReplayEvents = payload.events.some(
        event => event.event_type === "session_replay"
      );

      // Use larger size limit for session replay events (5MB), smaller for others (100KB)
      const effectiveMaxSize = hasSessionReplayEvents
        ? 5 * 1024 * 1024
        : this.maxPayloadSize;

      if (payloadString.length > effectiveMaxSize) {
        return {
          isValid: false,
          error: `Payload size ${payloadString.length} exceeds maximum ${effectiveMaxSize} (session_replay: ${hasSessionReplayEvents})`,
        };
      }

      // Validate required fields
      if (!payload.events || !Array.isArray(payload.events)) {
        return {
          isValid: false,
          error: "Payload must contain events array",
        };
      }

      if (payload.events.length === 0) {
        return {
          isValid: false,
          error: "Events array cannot be empty",
        };
      }

      // Validate each event
      for (let i = 0; i < payload.events.length; i++) {
        const event = payload.events[i];
        if (!event.event_type || !event.event_name) {
          return {
            isValid: false,
            error: `Event at index ${i} missing required fields: event_type or event_name`,
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Payload validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async export(events: TelemetryEvent[], _endpoint?: string): Promise<void> {
    if (!events.length) {
      this.logger.debug("No events to export to Hyperlook");
      return;
    }

    this.logger.debug("Exporting events to Hyperlook", {
      endpoint: HYPERLOOK_URL,
      eventCount: events.length,
    });

    try {
      // Split events into manageable batches
      const batches = this.validateAndSplitBatch(events);
      let totalExported = 0;

      for (const batch of batches) {
        // Transform events using the shared transformPayload method
        const payloadUnknown = this.transformPayload(batch);
        const payload = payloadUnknown as HyperlookPayload;

        // Validate payload before sending
        const validation = this.validatePayload(payload);
        if (!validation.isValid) {
          throw new Error(`Payload validation failed: ${validation.error}`);
        }

        if (!payload.events || payload.events.length === 0) {
          this.logger.warn("No valid events in batch after transformation");
          continue;
        }

        // Create separate timeouts for connection and request
        const connectionController = new AbortController();
        const requestController = new AbortController();

        const connectionTimeoutId = setTimeout(() => {
          connectionController.abort();
          this.logger.warn("Connection timeout reached", {
            endpoint: HYPERLOOK_URL,
          });
        }, this.connectionTimeout);

        const requestTimeoutId = setTimeout(() => {
          requestController.abort();
          this.logger.warn("Request timeout reached", {
            endpoint: HYPERLOOK_URL,
          });
        }, this.requestTimeout);

        try {
          const response = await fetch(HYPERLOOK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-API-Key": this.apiKey,
              "X-SDK-Version": getCurrentVersion(),
            },
            body: JSON.stringify(payload),
            signal: requestController.signal,
          });

          clearTimeout(connectionTimeoutId);
          clearTimeout(requestTimeoutId);

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorBody = await response.text();
              if (errorBody) {
                errorMessage += ` - ${errorBody}`;
              }
            } catch {
              // Ignore error reading response body
            }

            // Handle specific Hyperlook error codes
            if (response.status === 413) {
              throw new Error(`Payload too large: ${errorMessage}`);
            } else if (response.status === 429) {
              throw new Error(`Rate limited: ${errorMessage}`);
            } else if (response.status === 401) {
              throw new Error(`Authentication failed: ${errorMessage}`);
            } else if (response.status === 400) {
              throw new Error(`Bad request: ${errorMessage}`);
            } else {
              throw new Error(errorMessage);
            }
          }

          this.logger.debug("Hyperlook batch export successful", {
            status: response.status,
            statusText: response.statusText,
            batchSize: payload.events.length,
            responseSize: response.headers.get("content-length"),
          });

          totalExported += payload.events.length;
        } catch (error) {
          clearTimeout(connectionTimeoutId);
          clearTimeout(requestTimeoutId);

          // Enhanced error classification for Hyperlook
          let errorType = "unknown";
          let isRetryable = true;

          if (error instanceof Error) {
            if (error.name === "AbortError") {
              errorType = "timeout";
              isRetryable = true;
            } else if (error.message.includes("Failed to fetch")) {
              errorType = "network";
              isRetryable = true;
            } else if (error.message.includes("HTTP 5")) {
              errorType = "server_error";
              isRetryable = true;
            } else if (error.message.includes("HTTP 4")) {
              if (error.message.includes("413")) {
                errorType = "payload_too_large";
                isRetryable = false; // Don't retry oversized payloads
              } else if (error.message.includes("429")) {
                errorType = "rate_limited";
                isRetryable = true; // Retry rate limits with backoff
              } else if (error.message.includes("401")) {
                errorType = "auth_error";
                isRetryable = false; // Don't retry auth errors
              } else if (error.message.includes("400")) {
                errorType = "bad_request";
                isRetryable = false; // Don't retry bad requests
              } else {
                errorType = "client_error";
                isRetryable = false;
              }
            }
          }

          this.logger.error("Hyperlook batch export failed", {
            endpoint: HYPERLOOK_URL,
            errorType,
            isRetryable,
            batchSize: payload.events.length,
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });

          // Re-throw with additional context
          const enhancedError = new Error(
            `Hyperlook batch export failed (${errorType}): ${error instanceof Error ? error.message : String(error)}`
          );
          (enhancedError as EnhancedError).isRetryable = isRetryable;
          (enhancedError as EnhancedError).errorType = errorType;

          // Only throw for non-retryable errors to allow other batches to be processed
          if (!isRetryable) {
            throw enhancedError;
          } else {
            // For retryable errors, log and continue with next batch
            this.logger.warn(
              "Retryable error in batch, continuing with remaining batches",
              {
                batchSize: payload.events.length,
                errorType,
                totalExported,
              }
            );
          }
        }
      }

      this.logger.info("Hyperlook export completed", {
        totalEvents: events.length,
        totalExported,
        failedCount: events.length - totalExported,
      });
      // If nothing was exported at all, surface a retryable failure so the manager can retry/return to buffer
      if (totalExported === 0) {
        const noExportError: Error & Partial<EnhancedError> = new Error(
          "Hyperlook export completed with zero events exported"
        );
        noExportError.isRetryable = true;
        noExportError.errorType = "no_events_exported";
        throw noExportError;
      }
    } catch (error) {
      this.logger.error("Hyperlook export failed", {
        endpoint: HYPERLOOK_URL,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        eventCount: events.length,
      });
      throw error;
    }
  }
}

// Export types and utils
export * from "./types";
export * from "./utils";
