export type TelemetryPlugin = {
  /** Called once, passing in the manager to call `.capture(...)` on */
  initialize(manager: {
    capture(event: {
      eventType: string;
      eventName: string;
      payload: Record<string, unknown>;
      timestamp: string;
    }): void;
  }): void;
  /** Optional cleanup hook */
  teardown?(): void;
  /** Destroy the plugin and clean up all resources */
  destroy?(): void;
  /** Returns true if the plugin is supported in the current environment (e.g., browser vs SSR) */
  isSupported?(): boolean;
};
