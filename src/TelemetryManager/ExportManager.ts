import type { TelemetryEvent, TelemetryExporter, Logger } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";
import {
  generateEventId,
  hasNonRetryableError,
  extractErrorMessages,
} from "./utils";
import { MAX_BATCH_SIZE_BYTES } from "../constants";

export class ExportManager {
  private exporters: TelemetryExporter[] = [];
  private endpoint?: string;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;
  private maxRetries: number;
  private baseRetryDelay: number;
  private maxRetryDelay: number;
  private isFlushing = false;

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
      // Batch session replay events with max 5 per batch
      const batchedEvents = this.batchSessionReplayEvents(events);

      this.logger.info("Flushing events", {
        eventCount: events.length,
        batchedEventCount: batchedEvents.length,
        events: events.map(e => ({ type: e.eventType, name: e.eventName })),
        exporters: this.exporters.length,
        method: useBeacon ? "sendBeacon" : "fetch",
      });

      // Process each batch
      let allBatchesSuccessful = true;
      const eventsToReturnToBuffer: TelemetryEvent[] = [];

      for (const batch of batchedEvents) {
        // Assign event IDs to events that don't have them (preserve existing IDs for retries)
        const eventsWithIds: TelemetryEvent[] = batch.map(event => ({
          ...event,
          event_id: event.event_id || generateEventId(),
        }));

        // Use sendBeacon for critical shutdown scenarios
        if (useBeacon) {
          const result = this.flushWithBeacon(eventsWithIds);
          if (!result.success && result.shouldReturnToBuffer) {
            eventsToReturnToBuffer.push(...batch);
            allBatchesSuccessful = false;
          }
        } else {
          const result = await this.flushBatch(eventsWithIds, 0, startTime);
          if (!result.success && result.shouldReturnToBuffer) {
            eventsToReturnToBuffer.push(...batch);
            allBatchesSuccessful = false;
          }
        }
      }

      if (eventsToReturnToBuffer.length > 0) {
        this.logger.warn("Some batches failed, returning events to buffer", {
          totalEvents: events.length,
          failedEvents: eventsToReturnToBuffer.length,
          successfulEvents: events.length - eventsToReturnToBuffer.length,
        });
        return { success: false, shouldReturnToBuffer: true };
      }

      return { success: allBatchesSuccessful, shouldReturnToBuffer: false };
    } finally {
      this.isFlushing = false;
    }
  }

  private batchSessionReplayEvents(
    events: TelemetryEvent[]
  ): TelemetryEvent[][] {
    const batches: TelemetryEvent[][] = [];
    let currentBatch: TelemetryEvent[] = [];

    for (const event of events) {
      // For session replay events, check if the single event is too large
      if (event.eventType === "session_replay") {
        const singleEventSize = this.calculateSingleEventSize(event);

        if (singleEventSize > MAX_BATCH_SIZE_BYTES) {
          // If current batch has events, save it first
          if (currentBatch.length > 0) {
            batches.push([...currentBatch]);
            currentBatch = [];
          }

          // Send this large session replay event individually
          batches.push([event]);
          continue;
        }
      }

      // Calculate the size of the current batch if we add this event
      const testBatch = [...currentBatch, event];
      const batchSize = this.calculateBatchSize(testBatch);

      // If adding this event would exceed the size limit, start a new batch
      if (batchSize > MAX_BATCH_SIZE_BYTES && currentBatch.length > 0) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }

      currentBatch.push(event);
    }

    // Add the final batch if it has events
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    this.logger.debug("Batched events for export by size", {
      totalEvents: events.length,
      batches: batches.length,
      maxBatchSizeBytes: MAX_BATCH_SIZE_BYTES,
      batchSizes: batches.map(batch => ({
        eventCount: batch.length,
        sizeBytes: this.calculateBatchSize(batch),
        sizeKB: Math.round((this.calculateBatchSize(batch) / 1024) * 100) / 100,
      })),
      sessionReplayEvents: events.filter(e => e.eventType === "session_replay")
        .length,
    });

    return batches;
  }

  private calculateSingleEventSize(event: TelemetryEvent): number {
    try {
      const eventString = JSON.stringify(event);
      return new Blob([eventString]).size;
    } catch (error) {
      this.logger.warn(
        "Failed to calculate single event size, using fallback",
        {
          error: error instanceof Error ? error.message : String(error),
          eventType: event.eventType,
        }
      );

      // Fallback: estimate size based on event type
      if (event.eventType === "session_replay") {
        return 100 * 1024; // Estimate 100KB for session replay events
      } else {
        return 5 * 1024; // Estimate 5KB for regular events
      }
    }
  }

  private calculateBatchSize(events: TelemetryEvent[]): number {
    try {
      // Create a sample payload to estimate size
      const samplePayload = {
        events: events.map(event => ({
          eventType: event.eventType,
          eventName: event.eventName,
          timestamp: event.timestamp,
          userId: event.userId,
          sessionId: event.sessionId,
          // For session replay events, include a sample of the payload
          ...(event.eventType === "session_replay" && {
            payload: {
              rrweb_type: this.getPayloadProperty(event, "rrweb_type"),
              sessionId: this.getPayloadProperty(event, "sessionId"),
              eventCount: this.getEventsCount(event),
              // Include a small sample of the actual events for size estimation
              events: this.getEventsSample(event),
            },
          }),
        })),
      };

      const payloadString = JSON.stringify(samplePayload);
      return new Blob([payloadString]).size;
    } catch (error) {
      this.logger.warn("Failed to calculate batch size, using fallback", {
        error: error instanceof Error ? error.message : String(error),
        eventCount: events.length,
      });

      // Fallback: estimate size based on event count and type
      let estimatedSize = 0;
      for (const event of events) {
        if (event.eventType === "session_replay") {
          // Session replay events are typically larger due to DOM data
          estimatedSize += 50 * 1024; // Estimate 50KB per session replay event
        } else {
          // Regular events are typically smaller
          estimatedSize += 2 * 1024; // Estimate 2KB per regular event
        }
      }
      return estimatedSize;
    }
  }

  private getPayloadProperty(event: TelemetryEvent, property: string): unknown {
    try {
      const payload = event.payload;
      if (payload && typeof payload === "object") {
        return payload[property];
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private getEventsCount(event: TelemetryEvent): number {
    try {
      const payload = event.payload;
      if (payload && typeof payload === "object") {
        const events = payload.events;
        return Array.isArray(events) ? events.length : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private getEventsSample(event: TelemetryEvent): unknown[] {
    try {
      const payload = event.payload;
      if (payload && typeof payload === "object") {
        const events = payload.events;
        return Array.isArray(events) ? events.slice(0, 1) : [];
      }
      return [];
    } catch {
      return [];
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
