import type { LoggerConfig } from "./Logger";
import type { ExporterType } from "./ExporterTypes";

export type TelemetryConfig = {
  endpoint?: string; // Optional since we use hardcoded Hyperlook URL
  hyperlookApiKey?: string; // API key for Hyperlook exporter
  exporters?: ExporterType[]; // Array of enabled exporters
  enableClicks?: boolean;
  enableLogs?: boolean;
  enableNetwork?: boolean;
  enablePerformance?: boolean;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  samplingRate?: number;
  logging?: LoggerConfig;
  sessionId?: string;
  userId?: string;
  enableCustomEvents?: boolean;
};
