import type { TelemetryExporter, TelemetryEvent } from "../types";
import { getLogger } from "../logger";
import { getCurrentVersion } from "../utils/versionUtils";
import type { EnhancedError } from "../TelemetryManager/types";

export class HTTPExporter implements TelemetryExporter {
  private logger = getLogger();
  private connectionTimeout: number;
  private requestTimeout: number;

  constructor(
    connectionTimeout: number = 10000, // 10 seconds for connection
    requestTimeout: number = 45000 // 45 seconds for request (increased from 30)
  ) {
    // Validate parameters
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

    this.connectionTimeout = connectionTimeout;
    this.requestTimeout = requestTimeout;
    this.logger.debug("HttpExporter initialized", {
      connectionTimeout,
      requestTimeout,
    });
  }

  async export(events: TelemetryEvent[], endpoint?: string): Promise<void> {
    if (!endpoint || endpoint.trim() === "") {
      this.logger.warn("HTTP export skipped - no endpoint configured", {
        eventCount: events.length,
      });
      return;
    }

    this.logger.debug("Exporting events via HTTP", {
      endpoint,
      eventCount: events.length,
    });

    try {
      // Create separate timeouts for connection and request
      const connectionController = new AbortController();
      const requestController = new AbortController();

      const connectionTimeoutId = setTimeout(() => {
        connectionController.abort();
        this.logger.warn("Connection timeout reached", { endpoint });
      }, this.connectionTimeout);

      const requestTimeoutId = setTimeout(() => {
        requestController.abort();
        this.logger.warn("Request timeout reached", { endpoint });
      }, this.requestTimeout);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SDK-Version": getCurrentVersion(),
            "User-Agent": `TelemetrySDK/${getCurrentVersion()}`,
            Connection: "keep-alive",
          },
          body: JSON.stringify({ events }),
          signal: requestController.signal,
          // Add keep-alive for connection reuse
          keepalive: true,
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
          throw new Error(errorMessage);
        }

        this.logger.debug("HTTP export successful", {
          status: response.status,
          statusText: response.statusText,
          eventCount: events.length,
          responseSize: response.headers.get("content-length"),
        });
      } catch (error) {
        clearTimeout(connectionTimeoutId);
        clearTimeout(requestTimeoutId);

        // Enhanced error classification
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
            errorType = "client_error";
            isRetryable = false; // Don't retry client errors
          }
        }

        this.logger.error("HTTP export failed", {
          endpoint,
          errorType,
          isRetryable,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          eventCount: events.length,
        });

        // Re-throw with additional context
        const enhancedError = new Error(
          `HTTP export failed (${errorType}): ${error instanceof Error ? error.message : String(error)}`
        );
        (enhancedError as EnhancedError).isRetryable = isRetryable;
        (enhancedError as EnhancedError).errorType = errorType;
        throw enhancedError;
      }
    } catch (error) {
      this.logger.error("HTTP export failed", {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        eventCount: events.length,
      });
      throw error;
    }
  }
}
