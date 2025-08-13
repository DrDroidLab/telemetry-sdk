import type { TelemetryEvent, TelemetryExporter, Logger } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";

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
      return { success: false, shouldReturnToBuffer: true }; // Return to buffer instead of dropping
    }

    this.isFlushing = true;
    let retries = 0;
    let lastErrors: unknown[] = [];
    const startTime = Date.now();

    try {
      this.logger.info("Flushing events", {
        eventCount: events.length,
        events: events.map(e => ({ type: e.eventType, name: e.eventName })),
        exporters: this.exporters.length,
      });

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
            "Events exported successfully to at least one exporter",
            {
              eventCount: events.length,
              retries,
              duration: Date.now() - startTime,
            }
          );
          return { success: true, shouldReturnToBuffer: false };
        } else {
          retries++;
          this.circuitBreaker.recordFailure();

          const errorMessages = lastErrors.map(e =>
            e instanceof Error ? e.message : String(e)
          );

          this.logger.error("Failed to export events to all exporters", {
            eventCount: events.length,
            retry: retries,
            maxRetries: this.maxRetries,
            consecutiveFailures:
              this.circuitBreaker.getState().consecutiveFailures,
            errors: errorMessages,
            duration: Date.now() - startTime,
          });

          if (retries <= this.maxRetries) {
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
                "Max retries exceeded, events returned to buffer",
                {
                  eventCount: events.length,
                  totalDuration: Date.now() - startTime,
                }
              );
              return { success: false, shouldReturnToBuffer: true };
            } else {
              this.logger.error(
                "Max retries exceeded, circuit breaker open, events returned to buffer",
                {
                  eventCount: events.length,
                  totalDuration: Date.now() - startTime,
                }
              );
              return { success: false, shouldReturnToBuffer: true }; // Changed from false to true
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
