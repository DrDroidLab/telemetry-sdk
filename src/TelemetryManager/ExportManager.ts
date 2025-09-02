import type { TelemetryEvent, TelemetryExporter, Logger } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";
import {
  generateEventId,
  hasNonRetryableError,
  extractErrorMessages,
} from "./utils";

import { SessionReplayExportHandler } from "./SessionReplayExportHandler";

export class ExportManager {
  private exporters: TelemetryExporter[] = [];
  private endpoint?: string;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;
  private maxRetries: number;
  private baseRetryDelay: number;
  private maxRetryDelay: number;
  private isFlushing = false;
  private sessionReplayHandler: SessionReplayExportHandler;

  constructor(
    logger: Logger,
    exporters: TelemetryExporter[],
    maxRetries: number = 5, // Increased from 3
    baseRetryDelay: number = 1000, // Base delay for exponential backoff
    maxRetryDelay: number = 30000, // Maximum delay cap
    endpoint?: string
  ) {
    this.logger = logger;
    this.exporters = exporters;
    if (endpoint) {
      this.endpoint = endpoint;
    }
    this.maxRetries = maxRetries;
    this.baseRetryDelay = baseRetryDelay;
    this.maxRetryDelay = maxRetryDelay;
    this.circuitBreaker = new CircuitBreaker(logger);
    this.sessionReplayHandler = new SessionReplayExportHandler(logger);
  }

  /**
   * Flush events using sendBeacon for critical shutdown scenarios
   */
  private flushWithBeacon(events: TelemetryEvent[]): {
    success: boolean;
    shouldReturnToBuffer: boolean;
  } {
    if (
      typeof window === "undefined" ||
      typeof window.navigator === "undefined" ||
      !window.navigator.sendBeacon
    ) {
      this.logger.warn("sendBeacon not supported, falling back to fetch");
      return { success: false, shouldReturnToBuffer: true };
    }

    try {
      // Try to send to each exporter endpoint
      let anySuccess = false;

      for (const exporter of this.exporters) {
        try {
          // Resolve endpoint via exporter hook (no hardcoding)
          const endpoint = exporter.getEndpoint
            ? exporter.getEndpoint(this.endpoint)
            : this.endpoint;
          if (!endpoint) {
            continue;
          }

          // Create payload via exporter hook (no hardcoding)
          const payloadUnknown = exporter.transformPayload
            ? exporter.transformPayload(events, true)
            : { events };
          const payload = payloadUnknown as { events?: unknown[] };

          // Handle size limits (64KB for sendBeacon)
          const payloadString = JSON.stringify(payloadUnknown);
          if (payloadString.length > 64 * 1024) {
            // Truncate events to fit within beacon limit
            const truncatedEvents = events.slice(
              0,
              Math.floor(events.length / 2)
            );
            const truncatedUnknown = exporter.transformPayload
              ? exporter.transformPayload(truncatedEvents, true)
              : { events: truncatedEvents };
            const truncatedPayload = truncatedUnknown as { events?: unknown[] };
            payload.events = truncatedPayload.events || [];
          }

          // Log the beacon payload for debugging
          this.logger.debug("Sending beacon payload", {
            endpoint,
            payloadSize: JSON.stringify(payloadUnknown).length,
            payloadPreview:
              JSON.stringify(payloadUnknown).substring(0, 200) + "...",
          });

          const success = window.navigator.sendBeacon(
            endpoint,
            new Blob([JSON.stringify(payloadUnknown)], {
              type: "application/json",
            })
          );

          if (success) {
            anySuccess = true;
            this.logger.debug("Events sent successfully via sendBeacon", {
              endpoint,
              eventCount: events.length,
              payloadSize: JSON.stringify(payloadUnknown).length,
            });
          } else {
            this.logger.warn("sendBeacon returned false", {
              endpoint,
              eventCount: events.length,
            });
          }
        } catch (error) {
          this.logger.debug("sendBeacon failed for exporter", {
            exporterType: exporter.constructor.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (anySuccess) {
        this.circuitBreaker.recordSuccess();
        return { success: true, shouldReturnToBuffer: false };
      } else {
        this.logger.warn(
          "sendBeacon failed for all exporters, returning to buffer"
        );
        return { success: false, shouldReturnToBuffer: true };
      }
    } catch (error) {
      this.logger.error("sendBeacon flush failed", {
        error: error instanceof Error ? error.message : String(error),
        eventCount: events.length,
      });
      return { success: false, shouldReturnToBuffer: true };
    }
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.baseRetryDelay * Math.pow(2, attempt - 1),
      this.maxRetryDelay
    );

    // Add jitter (±25%) to prevent thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    return Math.max(100, exponentialDelay + jitter);
  }

  async flush(
    events: TelemetryEvent[],
    useBeacon: boolean = false
  ): Promise<{ success: boolean; shouldReturnToBuffer: boolean }> {
    if (!events.length) {
      this.logger.debug("No events to flush");
      return { success: true, shouldReturnToBuffer: false };
    }

    if (this.isFlushing) {
      this.logger.debug("Flush already in progress, skipping");
      return { success: false, shouldReturnToBuffer: false };
    }

    // Check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      this.logger.warn("Circuit breaker is open, skipping flush", {
        consecutiveFailures: this.circuitBreaker.getState().consecutiveFailures,
        lastFailureTime: this.circuitBreaker.getState().lastFailureTime,
      });
      return { success: false, shouldReturnToBuffer: true }; // Return to buffer instead of dropping
    }

    this.isFlushing = true;
    const startTime = Date.now();

    try {
      // Separate session replay events from normal events
      const sessionReplayEvents = events.filter(
        e => e.eventType === "session_replay"
      );
      const normalEvents = events.filter(e => e.eventType !== "session_replay");

      this.logger.info("Flushing events", {
        eventCount: events.length,
        sessionReplayEvents: sessionReplayEvents.length,
        normalEvents: normalEvents.length,
        exporters: this.exporters.length,
        method: useBeacon ? "sendBeacon" : "fetch",
      });

      let allEventsSuccessful = true;
      const eventsToReturnToBuffer: TelemetryEvent[] = [];

      // Handle normal events with original logic (single batch)
      if (normalEvents.length > 0) {
        const eventsWithIds: TelemetryEvent[] = normalEvents.map(event => ({
          ...event,
          event_id: event.event_id || generateEventId(),
        }));

        let result;
        if (useBeacon) {
          result = this.flushWithBeacon(eventsWithIds);
        } else {
          result = await this.flushBatch(eventsWithIds, 0, startTime);
        }

        if (!result.success && result.shouldReturnToBuffer) {
          eventsToReturnToBuffer.push(...normalEvents);
          allEventsSuccessful = false;
        }
      }

      // Handle session replay events with special logic
      if (sessionReplayEvents.length > 0) {
        const sessionReplayResult =
          await this.sessionReplayHandler.handleSessionReplayExports(
            sessionReplayEvents,
            this.flushWithBeacon.bind(this),
            this.flushBatch.bind(this),
            useBeacon
          );

        if (!sessionReplayResult.success) {
          eventsToReturnToBuffer.push(...sessionReplayResult.failedEvents);
          allEventsSuccessful = false;
        }
      }

      if (eventsToReturnToBuffer.length > 0) {
        this.logger.warn("Some events failed, returning to buffer", {
          totalEvents: events.length,
          failedEvents: eventsToReturnToBuffer.length,
          successfulEvents: events.length - eventsToReturnToBuffer.length,
        });
        return { success: false, shouldReturnToBuffer: true };
      }

      return { success: allEventsSuccessful, shouldReturnToBuffer: false };
    } finally {
      this.isFlushing = false;
    }
  }

  private async flushBatch(
    events: TelemetryEvent[],
    retries: number,
    startTime: number
  ): Promise<{ success: boolean; shouldReturnToBuffer: boolean }> {
    let lastErrors: unknown[] = [];

    while (retries < this.maxRetries) {
      const results = await Promise.all(
        this.exporters.map(async exporter => {
          try {
            await exporter.export(events, this.endpoint);
            return { success: true };
          } catch (error) {
            return { success: false, error };
          }
        })
      );

      const anySuccess = results.some(r => r.success);
      lastErrors = results.filter(r => !r.success).map(r => r.error);

      if (anySuccess) {
        this.circuitBreaker.recordSuccess();
        this.logger.info(
          "Batch exported successfully to at least one exporter",
          {
            eventCount: events.length,
            retries,
            duration: Date.now() - startTime,
          }
        );
        return { success: true, shouldReturnToBuffer: false };
      } else {
        // Check if any errors are non-retryable
        if (hasNonRetryableError(lastErrors)) {
          this.logger.error(
            "Non-retryable error encountered, stopping retries",
            {
              eventCount: events.length,
              retries,
              errors: extractErrorMessages(lastErrors),
            }
          );
          return { success: false, shouldReturnToBuffer: true };
        }

        retries++;
        this.circuitBreaker.recordFailure();

        const errorMessages = lastErrors.map(e =>
          e instanceof Error ? e.message : String(e)
        );

        this.logger.error("Failed to export batch to all exporters", {
          eventCount: events.length,
          retry: retries,
          maxRetries: this.maxRetries,
          consecutiveFailures:
            this.circuitBreaker.getState().consecutiveFailures,
          errors: errorMessages,
          duration: Date.now() - startTime,
        });

        if (retries < this.maxRetries) {
          const delay = this.calculateRetryDelay(retries);
          this.logger.debug("Waiting before retry", {
            delay,
            retry: retries,
            maxRetries: this.maxRetries,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Always return events to buffer on final failure unless circuit breaker is open
          const isCircuitOpen = this.circuitBreaker.isOpen();
          if (!isCircuitOpen) {
            this.logger.error(
              "Max retries exceeded, batch returned to buffer",
              {
                eventCount: events.length,
                totalDuration: Date.now() - startTime,
              }
            );
            return { success: false, shouldReturnToBuffer: true };
          } else {
            this.logger.error(
              "Max retries exceeded, circuit breaker open, batch returned to buffer",
              {
                eventCount: events.length,
                totalDuration: Date.now() - startTime,
              }
            );
            return { success: false, shouldReturnToBuffer: true };
          }
        }
      }
    }
    return { success: false, shouldReturnToBuffer: false };
  }

  setExporters(exporters: TelemetryExporter[]): void {
    this.exporters = exporters;
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  updateCircuitBreaker(
    maxFailures?: number,
    timeout?: number,
    failureThreshold?: number
  ): void {
    if (maxFailures || timeout || failureThreshold) {
      this.circuitBreaker = new CircuitBreaker(
        this.logger,
        maxFailures ?? 10,
        timeout ?? 60000,
        failureThreshold ?? 0.5
      );
    }
  }
}
