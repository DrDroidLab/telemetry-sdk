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
    this.plugins.push(plugin);
    plugin.initialize(this);
    this.logger.debug("Plugin registered", {
      pluginName: plugin.constructor.name,
      totalPlugins: this.plugins.length,
    });
  }

  capture(evt: TelemetryEvent) {
    if (this.isShutdown) {
      this.logger.warn("Cannot capture event - TelemetryManager is shutdown", {
        eventType: evt.eventType,
        eventName: evt.eventName,
      });
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

    this.buffer.push(evt);
    this.logger.debug("Event captured", {
      eventType: evt.eventType,
      eventName: evt.eventName,
      bufferSize: this.buffer.length,
    });

    if (this.buffer.length >= this.batchSize) {
      this.logger.info("Buffer full, triggering flush", {
        bufferSize: this.buffer.length,
        batchSize: this.batchSize,
      });
      this.flush();
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
        events: batch.map((e) => ({ type: e.eventType, name: e.eventName })),
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
            await new Promise((resolve) =>
              setTimeout(resolve, this.retryDelay * retries),
            );
          } else {
            // Re-add events to buffer on final failure
            this.buffer.unshift(...batch);
            this.logger.error(
              "Max retries exceeded, events returned to buffer",
              {
                eventCount: batch.length,
              },
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
}
