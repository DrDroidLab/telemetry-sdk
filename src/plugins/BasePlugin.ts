import type { TelemetryManager } from "../TelemetryManager";
import type { TelemetryEvent, Logger } from "../types";
import { getLogger } from "../logger";

export abstract class BasePlugin {
  protected manager!: TelemetryManager;
  protected logger: Logger;
  protected isEnabled = true;
  protected isInitialized = false;
  protected isDestroyed = false;

  constructor() {
    this.logger = getLogger();
  }

  initialize(manager: TelemetryManager): void {
    try {
      if (this.isInitialized) {
        this.logger.warn("Plugin already initialized", {
          pluginName: this.constructor.name,
        });
        return;
      }

      if (this.isDestroyed) {
        this.logger.error("Cannot initialize destroyed plugin", {
          pluginName: this.constructor.name,
        });
        return;
      }

      if (!manager) {
        throw new Error(
          "TelemetryManager is required for plugin initialization"
        );
      }

      this.manager = manager;

      if (this.isSupported()) {
        this.setup();
        this.isInitialized = true;
        this.logger.debug("Plugin initialized", {
          pluginName: this.constructor.name,
        });
      } else {
        this.logger.warn("Plugin not supported in this environment", {
          pluginName: this.constructor.name,
        });
        this.isEnabled = false;
      }
    } catch (error) {
      this.logger.error("Failed to initialize plugin", {
        pluginName: this.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
      throw error;
    }
  }

  protected abstract isSupported(): boolean;
  protected abstract setup(): void;

  protected safeCapture(event: TelemetryEvent): void {
    try {
      if (!this.isEnabled) {
        this.logger.debug("Plugin is disabled, skipping event capture", {
          pluginName: this.constructor.name,
          eventType: event.eventType,
          eventName: event.eventName,
        });
        return;
      }

      if (!this.isInitialized) {
        this.logger.warn("Plugin not initialized, skipping event capture", {
          pluginName: this.constructor.name,
          eventType: event.eventType,
          eventName: event.eventName,
        });
        return;
      }

      if (this.isDestroyed) {
        this.logger.warn("Plugin is destroyed, skipping event capture", {
          pluginName: this.constructor.name,
          eventType: event.eventType,
          eventName: event.eventName,
        });
        return;
      }

      if (!this.manager) {
        this.logger.error("TelemetryManager not available", {
          pluginName: this.constructor.name,
          eventType: event.eventType,
          eventName: event.eventName,
        });
        return;
      }

      this.manager.capture(event);
    } catch (error) {
      this.logger.error("Failed to capture event in plugin", {
        pluginName: this.constructor.name,
        eventType: event.eventType,
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  teardown?(): void;

  destroy(): void {
    try {
      if (this.isDestroyed) {
        return;
      }

      this.isDestroyed = true;
      this.isEnabled = false;
      this.isInitialized = false;

      if (this.teardown) {
        this.teardown();
      }

      this.logger.debug("Plugin destroyed", {
        pluginName: this.constructor.name,
      });
    } catch (error) {
      this.logger.error("Failed to destroy plugin", {
        pluginName: this.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  isPluginEnabled(): boolean {
    return this.isEnabled && this.isInitialized && !this.isDestroyed;
  }
}
