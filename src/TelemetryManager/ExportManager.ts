import type { TelemetryEvent, TelemetryExporter, Logger } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";

export class ExportManager {
  private exporters: TelemetryExporter[] = [];
  private endpoint?: string;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;
  private maxRetries: number;
  private retryDelay: number;
  private isFlushing = false;

  constructor(
    logger: Logger,
    exporters: TelemetryExporter[],
    maxRetries: number = 3,
    retryDelay: number = 1000,
    endpoint?: string
  ) {
    this.logger = logger;
    this.exporters = exporters;
    if (endpoint) {
      this.endpoint = endpoint;
    }
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
        exporters: this.exporters.length,
      });

      let retries = 0;
      let lastErrors: unknown[] = [];
      while (retries <= this.maxRetries) {
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
            "Events exported successfully to at least one exporter",
            {
              eventCount: events.length,
              retries,
            }
          );
          return { success: true, shouldReturnToBuffer: false };
        } else {
          retries++;
          this.circuitBreaker.recordFailure();
          this.logger.error("Failed to export events to all exporters", {
            eventCount: events.length,
            retry: retries,
            maxRetries: this.maxRetries,
            consecutiveFailures:
              this.circuitBreaker.getState().consecutiveFailures,
            errors: lastErrors.map(e =>
              e instanceof Error ? e.message : String(e)
            ),
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

  setExporters(exporters: TelemetryExporter[]): void {
    this.exporters = exporters;
  }

  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
}
