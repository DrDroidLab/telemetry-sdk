import { TelemetryManager } from "./TelemetryManager";
import {
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
} from "./plugins";
import type { TelemetryConfig } from "./types";
import { initialTelemetryConfig } from "./utils/initialTelemetryConfig";
export * from "./logger";

export function initTelemetry(
  userConfig: TelemetryConfig = initialTelemetryConfig
) {
  try {
    const manager = new TelemetryManager(userConfig);

    if (typeof window !== "undefined" && userConfig.enableClicks) {
      manager.register(new ClickPlugin());
    }

    if (typeof window !== "undefined" && userConfig.enableLogs) {
      manager.register(new LogPlugin());
    }

    if (typeof window !== "undefined" && userConfig.enableNetwork) {
      manager.register(new NetworkPlugin());
    }

    if (typeof window !== "undefined" && userConfig.enablePerformance) {
      manager.register(new PerformancePlugin());
    }

    // Custom events are handled automatically by TelemetryManager if enabled
    // to add new, you can add:
    // if (config.enableScroll) manager.register(new ScrollPlugin())

    return manager;
  } catch (error) {
    console.error("Failed to initialize telemetry", {
      error: error instanceof Error ? error.message : String(error),
    });

    // Return a minimal manager that does nothing but doesn't crash
    return {
      capture: () => {},
      register: () => {},
      shutdown: async () => {},
      destroy: () => {},
      retryFailedEvents: async () => {},
      isShutdown: true,
    } as any;
  }
}
