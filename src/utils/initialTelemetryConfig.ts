import type { TelemetryConfig } from "../types/TelemetryConfig";
import { ExporterType } from "../types/ExporterTypes";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.your-domain.com/telemetry", // Replace with your actual telemetry endpoint
  hyperlookApiKey: "your-hyperlook-api-key-here", // Replace with your actual Hyperlook API key
  exporters: [ExporterType.HYPERLOOK],
  enablePageViews: true, // Enable page view tracking by default
  batchSize: 100,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableErrors: true, // Enable error tracking by default
  enableCustomEvents: false, // Disabled by default
  captureStreamingMessages: false, // Disabled by default to avoid overwhelming telemetry
  flushInterval: 50000,
  maxRetries: 1,
  retryDelay: 1000,
  samplingRate: 1.0,
};
