import type { TelemetryManager } from "../TelemetryManager";
import type { TelemetryPlugin } from "../types";

import { getLogger } from "../logger";

export abstract class BasePlugin implements TelemetryPlugin {
  protected manager!: TelemetryManager;
  protected logger = getLogger();
  protected isInitialized = false;
  protected isEnabled = true;

  initialize(manager: TelemetryManager) {
    try {
      this.manager = manager;
      this.setup();
      this.isInitialized = true;
      this.logger.debug("Plugin initialized successfully", {
        pluginName: this.constructor.name,
      });
    } catch (error) {
      this.logger.error("Failed to initialize plugin", {
        pluginName: this.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
      throw error;
    }
  }

  /** Override to register your listeners/patches */
  protected abstract setup(): void;

  /** Override if you need to clean up event listeners */
  teardown?(): void;

  /**
   * Safely capture an event with error handling
   */
  protected safeCapture(event: any): void {
    if (!this.isEnabled || !this.isInitialized) {
      this.logger.debug(
        "Plugin not enabled or initialized, skipping event capture",
        {
          pluginName: this.constructor.name,
          eventType: event?.eventType,
        },
      );
      return;
    }

    try {
      this.manager.capture(event);
    } catch (error) {
      this.logger.error("Failed to capture event in plugin", {
        pluginName: this.constructor.name,
        eventType: event?.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if the plugin is supported in the current environment
   */
  protected isSupported(): boolean {
    return true; // Override in subclasses for environment-specific checks
  }
}
