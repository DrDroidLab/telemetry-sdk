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
import {
  BasePlugin,
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
  CustomEventsPlugin,
} from "./plugins";
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
