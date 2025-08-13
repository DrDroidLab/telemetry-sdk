import { initTelemetry } from "../src/index";

// Hyperlook-specific reliability configuration
// This addresses the 12.50% error rate issue with ingest.hyperlook.io
const telemetry = initTelemetry({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // Core settings
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,

  // Hyperlook-specific reliability settings
  hyperlookMaxBatchSize: 25, // Smaller batches to prevent oversized payloads
  hyperlookMaxPayloadSize: 512 * 1024, // 512KB max payload (reduced from 1MB)

  // General reliability settings optimized for Hyperlook
  batchSize: 25, // Match Hyperlook batch size
  flushInterval: 15000, // More frequent flushes (15 seconds)

  // Retry configuration with exponential backoff
  maxRetries: 7, // More retries for network issues
  retryDelay: 500, // Start with 500ms
  maxRetryDelay: 60000, // Cap at 60 seconds

  // Timeout settings optimized for Hyperlook
  connectionTimeout: 15000, // 15 seconds for connection
  requestTimeout: 60000, // 60 seconds for request completion

  // Circuit breaker settings
  circuitBreakerMaxFailures: 15, // More failures before opening
  circuitBreakerTimeout: 120000, // 2 minutes before half-open
  circuitBreakerFailureThreshold: 0.6, // 60% failure rate threshold

  // Sampling for high-volume scenarios
  samplingRate: 0.8, // 80% sampling rate
});

console.log("Hyperlook-optimized telemetry initialized!");

// Monitor Hyperlook-specific metrics
setInterval(() => {
  const failedCount = telemetry.getFailedEventsCount();
  const queuedCount = telemetry.getQueuedEventsCount();
  const bufferedCount = telemetry.getBufferedEventsCount();
  const circuitState = telemetry.getCircuitBreakerState?.();

  console.log("Hyperlook Reliability Status:", {
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

// Example: Production configuration specifically for Hyperlook
export const getHyperlookProductionConfig = () => ({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // Hyperlook-specific optimizations
  hyperlookMaxBatchSize: 20, // Conservative batch size
  hyperlookMaxPayloadSize: 256 * 1024, // 256KB max payload

  // Reliability settings
  batchSize: 20, // Match Hyperlook batch size
  flushInterval: 10000, // 10-second flushes for real-time data
  maxRetries: 8, // More retries for critical data
  retryDelay: 300, // Faster initial retry
  maxRetryDelay: 45000, // Shorter max delay

  // Timeout settings
  connectionTimeout: 10000, // 10 seconds
  requestTimeout: 45000, // 45 seconds

  // Circuit breaker - more conservative
  circuitBreakerMaxFailures: 20, // Higher threshold
  circuitBreakerTimeout: 90000, // 90 seconds
  circuitBreakerFailureThreshold: 0.7, // 70% failure rate

  // Sampling
  samplingRate: 0.9, // 90% sampling for important data
});

// Example: Development configuration for debugging Hyperlook issues
export const getHyperlookDevelopmentConfig = () => ({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // Development settings
  hyperlookMaxBatchSize: 10, // Very small batches for debugging
  hyperlookMaxPayloadSize: 128 * 1024, // 128KB max payload

  // Reliability settings
  batchSize: 10,
  flushInterval: 5000, // 5-second flushes
  maxRetries: 5,
  retryDelay: 1000,
  maxRetryDelay: 30000,

  // Timeout settings
  connectionTimeout: 5000, // 5 seconds
  requestTimeout: 30000, // 30 seconds

  // Circuit breaker - more sensitive for debugging
  circuitBreakerMaxFailures: 5, // Lower threshold
  circuitBreakerTimeout: 30000, // 30 seconds
  circuitBreakerFailureThreshold: 0.3, // 30% failure rate

  // Sampling
  samplingRate: 1.0, // 100% sampling for debugging
});

// Example: High-traffic configuration for Hyperlook
export const getHyperlookHighTrafficConfig = () => ({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // High-traffic optimizations
  hyperlookMaxBatchSize: 15, // Smaller batches for faster processing
  hyperlookMaxPayloadSize: 512 * 1024, // 512KB max payload

  // Reliability settings
  batchSize: 15,
  flushInterval: 8000, // 8-second flushes
  maxRetries: 6,
  retryDelay: 400,
  maxRetryDelay: 40000,

  // Timeout settings
  connectionTimeout: 8000, // 8 seconds
  requestTimeout: 40000, // 40 seconds

  // Circuit breaker
  circuitBreakerMaxFailures: 12,
  circuitBreakerTimeout: 60000, // 60 seconds
  circuitBreakerFailureThreshold: 0.5, // 50% failure rate

  // Sampling
  samplingRate: 0.6, // 60% sampling for high traffic
});

// Example: Mobile/Unstable network configuration for Hyperlook
export const getHyperlookMobileConfig = () => ({
  hyperlookApiKey: "your-actual-hyperlook-api-key",

  // Mobile optimizations
  hyperlookMaxBatchSize: 10, // Very small batches
  hyperlookMaxPayloadSize: 256 * 1024, // 256KB max payload

  // Reliability settings
  batchSize: 10,
  flushInterval: 20000, // 20-second flushes
  maxRetries: 10, // More retries for mobile
  retryDelay: 1000,
  maxRetryDelay: 90000, // Longer max delay for mobile

  // Timeout settings
  connectionTimeout: 20000, // 20 seconds
  requestTimeout: 90000, // 90 seconds

  // Circuit breaker - very conservative
  circuitBreakerMaxFailures: 25, // Higher threshold for mobile
  circuitBreakerTimeout: 180000, // 3 minutes
  circuitBreakerFailureThreshold: 0.8, // 80% failure rate

  // Sampling
  samplingRate: 0.5, // 50% sampling for mobile
});
