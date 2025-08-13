import { TelemetryManager } from "./TelemetryManager";
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryExporter,
  TelemetryPlugin,
  Logger,
  LogLevel,
  LoggerConfig,
} from "./types";
import { HTTPExporter } from "./exporters";
import { getLogger, setLogger, createLogger } from "./logger";
import { BasePlugin } from "./plugins/BasePlugin";
import { ClickPlugin } from "./plugins/ClickPlugin";
import { LogPlugin } from "./plugins/LogPlugin";
import { NetworkPlugin } from "./plugins/NetworkPlugin";
import { PerformancePlugin } from "./plugins/PerformancePlugin";
import { CustomEventsPlugin } from "./plugins/CustomEventsPlugin";
import { PageViewPlugin } from "./plugins/PageViewPlugin";
import { ErrorPlugin } from "./plugins/ErrorPlugin";
import { initialTelemetryConfig } from "./utils/initialTelemetryConfig";
import { getCurrentVersion } from "./utils/versionUtils";

export {
  TelemetryManager,
  BasePlugin,
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
  CustomEventsPlugin,
  PageViewPlugin,
  ErrorPlugin,
  HTTPExporter,
  getLogger,
  setLogger,
  createLogger,
  getCurrentVersion,
};

export type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryExporter,
  TelemetryPlugin,
  Logger,
  LogLevel,
  LoggerConfig,
};

export function initTelemetry(
  config: Partial<TelemetryConfig> = {}
): TelemetryManager {
  const finalConfig = { ...initialTelemetryConfig, ...config };
  const telemetry = new TelemetryManager(finalConfig);

  // Set up automatic shutdown handlers to ensure events are flushed
  // when the application closes, even if developers forget to add them manually
  if (typeof window !== "undefined") {
    // Browser environment
    const gracefulShutdown = async () => {
      try {
        // Only shutdown if not already shutting down or shutdown
        if (!telemetry.isShutdown()) {
          await telemetry.shutdown();
        }
      } catch (error) {
        // If shutdown fails, force destroy to prevent memory leaks
        console.warn("Telemetry shutdown failed, forcing destroy:", error);
        telemetry.destroy();
      }
    };

    // Handle page unload events
    window.addEventListener("beforeunload", () => {
      void gracefulShutdown();
    });
    window.addEventListener("pagehide", () => {
      void gracefulShutdown();
    });

    // Handle visibility change (when user switches tabs/apps)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        // Use a timeout to allow the page to potentially become visible again
        // This prevents unnecessary flushes when user just switches tabs
        setTimeout(() => {
          if (
            document.visibilityState === "hidden" &&
            !telemetry.isShutdown()
          ) {
            telemetry.flush().catch(error => {
              console.warn("Visibility change flush failed:", error);
            });
          }
        }, 1000);
      }
    });
  } else if (typeof process !== "undefined") {
    // Node.js environment
    const gracefulShutdown = async (signal?: string) => {
      try {
        console.log(
          `Received ${signal || "shutdown"} signal, flushing telemetry...`
        );

        // Only shutdown if not already shutting down or shutdown
        if (!telemetry.isShutdown()) {
          await telemetry.shutdown();
        }
      } catch (error) {
        // If shutdown fails, force destroy to prevent memory leaks
        console.warn("Telemetry shutdown failed, forcing destroy:", error);
        telemetry.destroy();
      }
    };

    // Handle process exit events
    process.on("exit", () => {
      // Note: 'exit' event handlers are synchronous, so we can't use async/await
      // Just force destroy to ensure cleanup
      if (!telemetry.isShutdown()) {
        telemetry.destroy();
      }
    });

    // Handle graceful shutdown signals
    process.on("SIGTERM", () => {
      void gracefulShutdown("SIGTERM");
    });
    process.on("SIGINT", () => {
      void gracefulShutdown("SIGINT");
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on("uncaughtException", error => {
      console.error("Uncaught exception:", error);
      void gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled rejection at:", promise, "reason:", reason);
      void gracefulShutdown("unhandledRejection");
    });
  }

  return telemetry;
}
