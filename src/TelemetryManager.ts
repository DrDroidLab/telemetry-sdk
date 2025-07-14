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
  private logger: Logger;

  constructor(config: TelemetryConfig) {
    this.exporter = new HTTPExporter(config.endpoint);
    this.batchSize = config.batchSize ?? 50;

    // Initialize logger
    if (config.logging) {
      const customLogger = createLogger(config.logging);
      setLogger(customLogger);
    }
    this.logger = getLogger();

    this.logger.info("TelemetryManager initialized", {
      endpoint: config.endpoint,
      batchSize: this.batchSize,
      enableClicks: config.enableClicks,
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

  async flush() {
    if (!this.buffer.length) {
      this.logger.debug("No events to flush");
      return;
    }

    const batch = this.buffer.splice(0);
    this.logger.info("Flushing events", {
      eventCount: batch.length,
      events: batch.map((e) => ({ type: e.eventType, name: e.eventName })),
    });

    try {
      await this.exporter.export(batch);
      this.logger.info("Events exported successfully", {
        eventCount: batch.length,
      });
    } catch (error) {
      this.logger.error("Failed to export events", {
        error: error instanceof Error ? error.message : String(error),
        eventCount: batch.length,
      });
      // Re-add events to buffer on failure
      this.buffer.unshift(...batch);
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
}
