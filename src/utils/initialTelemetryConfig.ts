import type { TelemetryConfig } from "../types/TelemetryConfig";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://httpbin.org/post", // Using httpbin.org for testing - it accepts POST requests and returns the data
  batchSize: 50,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  flushInterval: 10000,
  maxRetries: 3,
  retryDelay: 1000,
  samplingRate: 1.0,
};
