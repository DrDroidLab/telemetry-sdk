import { HTTPExporter } from "./exporters";
import { getLogger, setLogger, createLogger } from "./logger";
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryExporter,
  TelemetryPlugin,
  Logger,
} from "./types";

export class TelemetryManager {
  private buffer: TelemetryEvent[] = [];
  private plugins: TelemetryPlugin[] = [];
  private exporter: TelemetryExporter;
  private batchSize: number;
  private flushInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private samplingRate: number;
  private flushTimer?: NodeJS.Timeout;
  private logger: Logger;
  private eventQueue: TelemetryEvent[] = [];
  private isProcessingQueue = false;
  private failedEvents: TelemetryEvent[] = [];
  private maxFailedEvents = 1000; // Prevent memory leaks from failed events

  constructor(config: TelemetryConfig) {
    this.validateConfig(config);
    this.exporter = new HTTPExporter(config.endpoint);
    this.batchSize = config.batchSize ?? 50;
    this.flushInterval = config.flushInterval ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.samplingRate = config.samplingRate ?? 1.0;

    // Initialize logger
    if (config.logging) {
      const customLogger = createLogger(config.logging);
      setLogger(customLogger);
    }
    this.logger = getLogger();

    // Start periodic flush timer
    this.startFlushTimer();

    this.logger.info("TelemetryManager initialized", {
      endpoint: config.endpoint,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
      maxRetries: this.maxRetries,
      samplingRate: this.samplingRate,
      enableClicks: config.enableClicks,
      enablePerformance: config.enablePerformance,
    });
  }

  register(plugin: TelemetryPlugin) {
    try {
      this.plugins.push(plugin);
      plugin.initialize(this);
      this.logger.debug("Plugin registered", {
        pluginName: plugin.constructor.name,
        totalPlugins: this.plugins.length,
      });
    } catch (error) {
      this.logger.error("Failed to register plugin", {
        pluginName: plugin.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      // Remove the plugin from the array if initialization failed
      this.plugins.pop();
    }
  }

  capture(evt: TelemetryEvent) {
    try {
      if (this.isShutdown) {
        this.logger.warn(
          "Cannot capture event - TelemetryManager is shutdown",
          {
            eventType: evt.eventType,
            eventName: evt.eventName,
          }
        );
        return;
      }

      // Apply sampling
      if (Math.random() > this.samplingRate) {
        this.logger.debug("Event dropped due to sampling", {
          eventType: evt.eventType,
          eventName: evt.eventName,
          samplingRate: this.samplingRate,
        });
        return;
      }

      // Add event to queue for proper ordering
      this.eventQueue.push(evt);
      this.logger.debug("Event queued", {
        eventType: evt.eventType,
        eventName: evt.eventName,
        queueSize: this.eventQueue.length,
      });

      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processEventQueue();
      }

      // Check if we should flush
      if (this.buffer.length >= this.batchSize) {
        this.logger.info("Buffer full, triggering flush", {
          bufferSize: this.buffer.length,
          batchSize: this.batchSize,
        });
        this.flush();
      }
    } catch (error) {
      this.logger.error("Failed to capture event", {
        eventType: evt.eventType,
        eventName: evt.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startFlushTimer(): void {
    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (this.buffer.length > 0) {
          this.logger.debug("Periodic flush triggered", {
            bufferSize: this.buffer.length,
            flushInterval: this.flushInterval,
          });
          this.flush();
        }
      }, this.flushInterval);
    }
  }

  private isFlushing = false;

  async flush() {
    if (!this.buffer.length) {
      this.logger.debug("No events to flush");
      return;
    }

    // Prevent concurrent flush operations
    if (this.isFlushing) {
      this.logger.debug("Flush already in progress, skipping");
      return;
    }

    this.isFlushing = true;

    try {
      const batch = this.buffer.splice(0);
      this.logger.info("Flushing events", {
        eventCount: batch.length,
        events: batch.map(e => ({ type: e.eventType, name: e.eventName })),
      });

      let retries = 0;
      while (retries <= this.maxRetries) {
        try {
          await this.exporter.export(batch);
          this.logger.info("Events exported successfully", {
            eventCount: batch.length,
            retries,
          });
          return;
        } catch (error) {
          retries++;
          this.logger.error("Failed to export events", {
            error: error instanceof Error ? error.message : String(error),
            eventCount: batch.length,
            retry: retries,
            maxRetries: this.maxRetries,
          });

          if (retries <= this.maxRetries) {
            // Wait before retrying
            await new Promise(resolve =>
              setTimeout(resolve, this.retryDelay * retries)
            );
          } else {
            // Re-add events to buffer on final failure
            this.buffer.unshift(...batch);
            this.logger.error(
              "Max retries exceeded, events returned to buffer",
              {
                eventCount: batch.length,
              }
            );
          }
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Shutdown the telemetry manager and cleanup all resources
   * This should be called when the telemetry instance is no longer needed
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down TelemetryManager");

    // Stop accepting new events
    this.isShutdown = true;

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Teardown all plugins
    for (const p of this.plugins) {
      try {
        p.teardown?.();
        this.logger.debug("Plugin teardown completed", {
          pluginName: p.constructor.name,
        });
      } catch (error) {
        this.logger.error("Plugin teardown failed", {
          pluginName: p.constructor.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Flush any remaining events
    await this.flush();

    // Clear all references
    this.plugins = [];
    this.buffer = [];
    this.exporter = null as any;

    this.logger.info("TelemetryManager shutdown complete");
  }

  /**
   * Force destroy the telemetry manager (for strict mode cleanup)
   * This immediately stops all operations and clears all data
   */
  destroy(): void {
    this.logger.warn("Force destroying TelemetryManager");

    // Stop accepting new events
    this.isShutdown = true;

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Immediately clear all data without flushing
    this.buffer = [];
    this.plugins = [];
    this.exporter = null as any;

    this.logger.info("TelemetryManager destroyed");
  }

  /**
   * Check if the telemetry manager is shutdown
   */
  isShutdown = false;

  private validateConfig(config: TelemetryConfig): void {
    if (!config.endpoint || config.endpoint.trim() === "") {
      throw new Error("Telemetry endpoint is required");
    }

    try {
      new URL(config.endpoint);
    } catch {
      throw new Error("Invalid endpoint URL format");
    }

    if (
      config.samplingRate !== undefined &&
      (config.samplingRate < 0 || config.samplingRate > 1)
    ) {
      throw new Error("Sampling rate must be between 0 and 1");
    }

    if (config.batchSize !== undefined && config.batchSize <= 0) {
      throw new Error("Batch size must be greater than 0");
    }

    if (config.flushInterval !== undefined && config.flushInterval < 0) {
      throw new Error("Flush interval must be non-negative");
    }

    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new Error("Max retries must be non-negative");
    }

    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      throw new Error("Retry delay must be non-negative");
    }
  }

  private async processEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;

        // Add to buffer for batching
        this.buffer.push(event);

        this.logger.debug("Event processed and added to buffer", {
          eventType: event.eventType,
          eventName: event.eventName,
          bufferSize: this.buffer.length,
        });
      }
    } catch (error) {
      this.logger.error("Failed to process event queue", {
        error: error instanceof Error ? error.message : String(error),
        queueSize: this.eventQueue.length,
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private handleFailedEvent(event: TelemetryEvent, error: unknown): void {
    // Add to failed events list for potential retry
    this.failedEvents.push(event);

    // Prevent memory leaks by limiting failed events
    if (this.failedEvents.length > this.maxFailedEvents) {
      const removed = this.failedEvents.shift();
      this.logger.warn("Removed old failed event to prevent memory leak", {
        eventType: removed?.eventType,
        eventName: removed?.eventName,
      });
    }

    this.logger.error("Event processing failed", {
      eventType: event.eventType,
      eventName: event.eventName,
      error: error instanceof Error ? error.message : String(error),
      failedEventsCount: this.failedEvents.length,
    });
  }

  /**
   * Retry failed events (useful for recovery scenarios)
   */
  async retryFailedEvents(): Promise<void> {
    if (this.failedEvents.length === 0) {
      this.logger.debug("No failed events to retry");
      return;
    }

    this.logger.info("Retrying failed events", {
      count: this.failedEvents.length,
    });

    const eventsToRetry = [...this.failedEvents];
    this.failedEvents = [];

    for (const event of eventsToRetry) {
      try {
        this.capture(event);
      } catch (error) {
        this.handleFailedEvent(event, error);
      }
    }
  }

  /**
   * Get the count of failed events
   */
  getFailedEventsCount(): number {
    return this.failedEvents.length;
  }

  /**
   * Get the count of queued events
   */
  getQueuedEventsCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Get the count of buffered events
   */
  getBufferedEventsCount(): number {
    return this.buffer.length;
  }
}
