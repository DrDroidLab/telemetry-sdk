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
};
