import type { TelemetryManager } from "../TelemetryManager";
import type { TelemetryEvent, Logger } from "../types";
import { getLogger } from "../logger";

export abstract class BasePlugin {
  protected manager!: TelemetryManager;
  protected logger: Logger;
  protected isEnabled = true;

  constructor() {
    this.logger = getLogger();
  }

  initialize(manager: TelemetryManager): void {
    this.manager = manager;
    if (this.isSupported()) {
      this.setup();
      this.logger.debug("Plugin initialized", {
        pluginName: this.constructor.name,
      });
    } else {
      this.logger.warn("Plugin not supported in this environment", {
        pluginName: this.constructor.name,
      });
      this.isEnabled = false;
    }
  }

  protected abstract isSupported(): boolean;
  protected abstract setup(): void;

  protected safeCapture(event: TelemetryEvent): void {
    if (this.isEnabled && this.manager) {
      this.manager.capture(event);
    }
  }

  teardown?(): void;
}
