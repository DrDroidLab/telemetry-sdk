import { HttpExporter } from "./exporters";
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
    this.exporter = new HttpExporter(config.endpoint);
    this.batchSize = config.batchSize ?? 50;

    // Initialize logger
    if (config.logging) {
      const customLogger = createLogger(config.logging);
      setLogger(customLogger);
    }
    this.logger = getLogger();

    this.logger.info("TelemetryManager initialized", {
      meta: {
        endpoint: config.endpoint,
        batchSize: this.batchSize,
        enableClicks: config.enableClicks,
      },
    });
  }

  register(plugin: TelemetryPlugin) {
    this.plugins.push(plugin);
    plugin.initialize(this);
    this.logger.debug("Plugin registered", {
      meta: {
        pluginName: plugin.constructor.name,
        totalPlugins: this.plugins.length,
      },
    });
  }

  capture(evt: TelemetryEvent) {
    this.buffer.push(evt);
    this.logger.debug("Event captured", {
      meta: {
        eventType: evt.eventType,
        eventName: evt.eventName,
        bufferSize: this.buffer.length,
      },
    });

    if (this.buffer.length >= this.batchSize) {
      this.logger.info("Buffer full, triggering flush", {
        meta: {
          bufferSize: this.buffer.length,
          batchSize: this.batchSize,
        },
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
      meta: {
        eventCount: batch.length,
        events: batch.map((e) => ({ type: e.eventType, name: e.eventName })),
      },
    });

    try {
      await this.exporter.export(batch);
      this.logger.info("Events exported successfully", {
        meta: { eventCount: batch.length },
      });
    } catch (error) {
      this.logger.error("Failed to export events", {
        meta: {
          error: error instanceof Error ? error.message : String(error),
          eventCount: batch.length,
        },
      });
      // Re-add events to buffer on failure
      this.buffer.unshift(...batch);
    }
  }

  shutdown() {
    this.logger.info("Shutting down TelemetryManager");

    for (const p of this.plugins) {
      try {
        p.teardown?.();
        this.logger.debug("Plugin teardown completed", {
          meta: { pluginName: p.constructor.name },
        });
      } catch (error) {
        this.logger.error("Plugin teardown failed", {
          meta: {
            pluginName: p.constructor.name,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    this.flush();
    this.logger.info("TelemetryManager shutdown complete");
  }
}
