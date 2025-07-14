import { TelemetryManager } from "./TelemetryManager";
import { ClickPlugin } from "./plugins/ClickPlugin";
import type { TelemetryConfig } from "./types";
export * from "./logger";

export function initTelemetry(userConfig: TelemetryConfig) {
  const config = {
    batchSize: 50,
    enableClicks: true,
    ...userConfig,
  };

  const manager = new TelemetryManager(config);

  if (typeof window !== "undefined" && config.enableClicks) {
    manager.register(new ClickPlugin());
  }

  // to add new, you can add:
  // if (config.enableScroll) manager.register(new ScrollPlugin())
  // if (config.enableNetwork) manager.register(new NetworkPlugin())

  return manager;
}
