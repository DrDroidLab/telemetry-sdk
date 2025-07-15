import type { TelemetryManager } from "../TelemetryManager";

export type TelemetryPlugin = {
  /** Called once, passing in the manager to call `.capture(...)` on */
  initialize(manager: TelemetryManager): void;
  /** Optional cleanup hook */
  teardown?(): void;
  /** Destroy the plugin and clean up all resources */
  destroy?(): void;
};
