import { TelemetryManager } from "./TelemetryManager";
import { ClickPlugin } from "./plugins/ClickPlugin";
import type { TelemetryConfig } from "./types";
import { initialTelemetryConfig } from "./utils/initialTelemetryConfig";
export * from "./logger";

export function initTelemetry(
  userConfig: TelemetryConfig = initialTelemetryConfig,
) {
  const manager = new TelemetryManager(userConfig);

  if (typeof window !== "undefined" && userConfig.enableClicks) {
    manager.register(new ClickPlugin());
  }

  // to add new, you can add:
  // if (config.enableScroll) manager.register(new ScrollPlugin())
  // if (config.enableNetwork) manager.register(new NetworkPlugin())

  return manager;
}
