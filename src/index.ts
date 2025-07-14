import { TelemetryManager } from "./TelemetryManager";
import { ClickPlugin, LogPlugin, PerformancePlugin } from "./plugins";
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

  if (typeof window !== "undefined" && userConfig.enableLogs) {
    manager.register(new LogPlugin());
  }

  if (typeof window !== "undefined" && userConfig.enablePerformance) {
    manager.register(new PerformancePlugin());
  }

  // to add new, you can add:
  // if (config.enableScroll) manager.register(new ScrollPlugin())
  // if (config.enableNetwork) manager.register(new NetworkPlugin())

  return manager;
}
