import type { TelemetryConfig } from "../types/TelemetryConfig";
import { ExporterType } from "../types/ExporterTypes";

export const initialTelemetryConfig: TelemetryConfig = {
  // Core settings
  exporters: [ExporterType.HYPERLOOK],

  // Feature flags - enable useful features by default
  enablePageViews: true,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableErrors: true,
  enableCustomEvents: false, // Disabled by default to avoid noise
  captureStreamingMessages: false, // Disabled by default to avoid overwhelming telemetry

  // Reliability settings - optimized for production use
  batchSize: 25, // Smaller batches for better reliability
  flushInterval: 15000, // 15 seconds - more frequent flushes
  maxRetries: 5, // Increased from 1 for better reliability
  retryDelay: 1000, // Base delay for exponential backoff
  maxRetryDelay: 30000, // Maximum delay cap

  // Timeout settings
  connectionTimeout: 10000, // 10 seconds for connection
  requestTimeout: 45000, // 45 seconds for request completion

  // Circuit breaker settings
  circuitBreakerMaxFailures: 10, // Conservative failure threshold
  circuitBreakerTimeout: 60000, // 1 minute before recovery
  circuitBreakerFailureThreshold: 0.5, // 50% failure rate threshold

  // Hyperlook-specific settings
  hyperlookMaxBatchSize: 25, // Match batch size for consistency
  hyperlookMaxPayloadSize: 512 * 1024, // 512KB max payload

  // Sampling and logging
  samplingRate: 1.0, // Full sampling by default
  logging: {
    enableConsole: false, // Disable console logging by default
  },
};
