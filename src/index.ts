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
import { initialTelemetryConfig } from "./utils/initialTelemetryConfig";

export {
  TelemetryManager,
  BasePlugin,
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
  CustomEventsPlugin,
  HTTPExporter,
  getLogger,
  setLogger,
  createLogger,
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
  return new TelemetryManager(finalConfig);
}
