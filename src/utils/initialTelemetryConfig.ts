import type { TelemetryConfig } from "../types/TelemetryConfig";
import { ExporterType } from "../types/ExporterTypes";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.your-domain.com/telemetry", // Replace with your actual telemetry endpoint
  hyperlookApiKey: "your-hyperlook-api-key-here", // Replace with your actual Hyperlook API key
  exporters: [ExporterType.HYPERLOOK],
  batchSize: 5,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableCustomEvents: false, // Disabled by default
  flushInterval: 10000,
  maxRetries: 3,
  retryDelay: 1000,
  samplingRate: 1.0,
};
