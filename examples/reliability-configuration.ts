import { initTelemetry } from "../src/index";

// High-reliability telemetry configuration
const telemetry = initTelemetry({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // Core settings
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,

  // Reliability settings - optimized for unstable networks
  batchSize: 25, // Smaller batches for faster processing
  flushInterval: 15000, // More frequent flushes (15 seconds)

  // Retry configuration with exponential backoff
  maxRetries: 7, // More retries
  retryDelay: 500, // Start with 500ms
  maxRetryDelay: 60000, // Cap at 60 seconds

  // Timeout settings
  connectionTimeout: 15000, // 15 seconds for connection
  requestTimeout: 60000, // 60 seconds for request completion

  // Circuit breaker settings
  circuitBreakerMaxFailures: 15, // More failures before opening
  circuitBreakerTimeout: 120000, // 2 minutes before half-open
  circuitBreakerFailureThreshold: 0.6, // 60% failure rate threshold

  // Sampling for high-volume scenarios
  samplingRate: 0.8, // 80% sampling rate
});

console.log("High-reliability telemetry initialized!");

// Example: Capture events with confidence
telemetry.capture({
  eventType: "user_action",
  eventName: "button_click",
  payload: {
    buttonId: "signup_button",
    page: "landing",
    timestamp: Date.now(),
  },
  timestamp: new Date().toISOString(),
});

// Monitor reliability metrics
setInterval(() => {
  const failedCount = telemetry.getFailedEventsCount();
  const queuedCount = telemetry.getQueuedEventsCount();
  const bufferedCount = telemetry.getBufferedEventsCount();
  const circuitState = telemetry.getCircuitBreakerState?.();

  console.log("Reliability Status:", {
    failed: failedCount,
    queued: queuedCount,
    buffered: bufferedCount,
    circuitOpen: circuitState?.isCircuitOpen,
    circuitHalfOpen: circuitState?.isHalfOpen,
    consecutiveFailures: circuitState?.consecutiveFailures,
    failureRate:
      circuitState?.totalAttempts > 0
        ? (
            circuitState.consecutiveFailures / circuitState.totalAttempts
          ).toFixed(2)
        : "0.00",
  });
}, 10000);

// Graceful shutdown with extended timeout
window.addEventListener("beforeunload", async () => {
  console.log("Shutting down telemetry...");
  await telemetry.shutdown();
  console.log("Telemetry shutdown complete");
});

// Example: Production-ready configuration for different environments
export const getReliabilityConfig = (
  environment: "development" | "staging" | "production"
) => {
  const baseConfig = {
    hyperlookApiKey: "your-actual-hyperlook-api-key",
    enableClicks: true,
    enableLogs: true,
    enableNetwork: true,
    enablePerformance: true,
  };

  switch (environment) {
    case "development":
      return {
        ...baseConfig,
        batchSize: 10,
        flushInterval: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        connectionTimeout: 5000,
        requestTimeout: 30000,
        samplingRate: 1.0, // Full sampling in dev
      };

    case "staging":
      return {
        ...baseConfig,
        batchSize: 20,
        flushInterval: 10000,
        maxRetries: 5,
        retryDelay: 1000,
        connectionTimeout: 10000,
        requestTimeout: 45000,
        samplingRate: 0.5, // 50% sampling in staging
      };

    case "production":
      return {
        ...baseConfig,
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
        samplingRate: 0.8, // 80% sampling in production
      };
  }
};
