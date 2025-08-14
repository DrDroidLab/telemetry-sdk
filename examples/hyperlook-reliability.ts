import { initTelemetry } from "../src/index";

// Hyperlook-specific reliability configuration
const telemetry = initTelemetry({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // Hyperlook-specific settings to fix 12.50% error rate
  hyperlookMaxBatchSize: 25, // Smaller batches
  hyperlookMaxPayloadSize: 512 * 1024, // 512KB max payload

  // Reliability settings
  batchSize: 25,
  flushInterval: 15000,
  maxRetries: 7,
  retryDelay: 500,
  maxRetryDelay: 60000,
  connectionTimeout: 15000,
  requestTimeout: 60000,
  circuitBreakerMaxFailures: 15,
  circuitBreakerTimeout: 120000,
  circuitBreakerFailureThreshold: 0.6,
  samplingRate: 0.8,
});

console.log("Hyperlook-optimized telemetry initialized!");

// Monitor reliability metrics
setInterval(() => {
  const circuitState = telemetry.getCircuitBreakerState?.();
  console.log("Hyperlook Status:", {
    circuitOpen: circuitState?.isCircuitOpen,
    consecutiveFailures: circuitState?.consecutiveFailures,
    failureRate:
      circuitState?.totalAttempts > 0
        ? (
            circuitState.consecutiveFailures / circuitState.totalAttempts
          ).toFixed(2)
        : "0.00",
  });
}, 10000);
