import type { TelemetryConfig } from "../types/TelemetryConfig";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.example.com/telemetry",
  batchSize: 5,
  enableClicks: true,
  enableLogs: true,
  enablePerformance: true,
  flushInterval: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  samplingRate: 1.0, // 100% sampling
};
