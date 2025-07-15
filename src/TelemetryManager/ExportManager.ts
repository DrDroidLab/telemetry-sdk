import type { TelemetryEvent, TelemetryExporter, Logger } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";

export class ExportManager {
  private exporter: TelemetryExporter | null = null;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;
  private maxRetries: number;
  private retryDelay: number;
  private isFlushing = false;

  constructor(
    logger: Logger,
    exporter: TelemetryExporter,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    this.logger = logger;
    this.exporter = exporter;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.circuitBreaker = new CircuitBreaker(logger);
  }

  async flush(
    events: TelemetryEvent[]
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
      return { success: false, shouldReturnToBuffer: false };
    }

    this.isFlushing = true;
    try {
      this.logger.info("Flushing events", {
        eventCount: events.length,
        events: events.map(e => ({ type: e.eventType, name: e.eventName })),
      });

      let retries = 0;
      while (retries <= this.maxRetries) {
        try {
          await this.exporter?.export(events);
          this.logger.info("Events exported successfully", {
            eventCount: events.length,
            retries,
          });

          // Reset circuit breaker on success
          this.circuitBreaker.recordSuccess();
          return { success: true, shouldReturnToBuffer: false };
        } catch (error) {
          retries++;
          this.circuitBreaker.recordFailure();

          this.logger.error("Failed to export events", {
            error: error instanceof Error ? error.message : String(error),
            eventCount: events.length,
            retry: retries,
            maxRetries: this.maxRetries,
            consecutiveFailures:
              this.circuitBreaker.getState().consecutiveFailures,
          });

          if (retries <= this.maxRetries) {
            await new Promise(resolve =>
              setTimeout(resolve, this.retryDelay * retries)
            );
          } else {
            // Don't return events to buffer if circuit breaker is open
            const isCircuitOpen = this.circuitBreaker.isOpen();
            if (!isCircuitOpen) {
              this.logger.error(
                "Max retries exceeded, events returned to buffer",
                {
                  eventCount: events.length,
                }
              );
              return { success: false, shouldReturnToBuffer: true };
            } else {
              this.logger.error(
                "Max retries exceeded, circuit breaker open, events dropped",
                {
                  eventCount: events.length,
                }
              );
              return { success: false, shouldReturnToBuffer: false };
            }
          }
        }
      }

      return { success: false, shouldReturnToBuffer: false };
    } finally {
      this.isFlushing = false;
    }
  }

  setExporter(exporter: TelemetryExporter | null): void {
    this.exporter = exporter;
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
}
