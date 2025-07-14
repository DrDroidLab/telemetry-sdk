import type { TelemetryManager } from "../TelemetryManager";
import type { TelemetryPlugin } from "../types";

export abstract class BasePlugin implements TelemetryPlugin {
  protected manager!: TelemetryManager;

  initialize(manager: TelemetryManager) {
    this.manager = manager;
    this.setup();
  }

  /** Override to register your listeners/patches */
  protected abstract setup(): void;

  /** Override if you need to clean up event listeners */
  teardown?(): void;
}
