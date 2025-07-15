import type { TelemetryConfig } from "../types/TelemetryConfig";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.your-domain.com/telemetry", // Replace with your actual telemetry endpoint
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
