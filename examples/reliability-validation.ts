import { initTelemetry } from "../src/index";

// Test configuration to validate reliability improvements
const testConfig = {
  hyperlookApiKey: "test-api-key", // This will fail, but we can test error handling

  // Test all reliability features
  batchSize: 10,
  flushInterval: 5000, // 5 seconds for quick testing
  maxRetries: 3,
  retryDelay: 500,
  maxRetryDelay: 5000,
  connectionTimeout: 5000,
  requestTimeout: 10000,
  circuitBreakerMaxFailures: 3,
  circuitBreakerTimeout: 10000,
  circuitBreakerFailureThreshold: 0.5,
  hyperlookMaxBatchSize: 10,
  hyperlookMaxPayloadSize: 256 * 1024,
  samplingRate: 1.0,

  // Enable all features for testing
  enablePageViews: true,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableErrors: true,
  enableCustomEvents: true,

  // Enable console logging for testing
  logging: {
    enableConsole: true,
  },
};

console.log("🧪 Testing Telemetry SDK Reliability Improvements...");

// Initialize telemetry with test config
const telemetry = initTelemetry(testConfig);

// Test 1: Basic event capture
console.log("\n📝 Test 1: Basic event capture");
telemetry.capture({
  eventType: "test",
  eventName: "reliability_test",
  payload: {
    message: "Testing reliability improvements",
    timestamp: Date.now(),
  },
  timestamp: new Date().toISOString(),
});

// Test 2: Multiple events to test batching
console.log("\n📦 Test 2: Multiple events for batching");
for (let i = 0; i < 15; i++) {
  telemetry.capture({
    eventType: "test",
    eventName: "batch_test",
    payload: {
      message: `Batch test event ${i}`,
      index: i,
      timestamp: Date.now(),
    },
    timestamp: new Date().toISOString(),
  });
}

// Test 3: Monitor circuit breaker state
console.log("\n🔌 Test 3: Circuit breaker monitoring");
let circuitBreakerChecks = 0;
const circuitBreakerInterval = setInterval(() => {
  const circuitState = telemetry.getCircuitBreakerState();
  circuitBreakerChecks++;

  console.log(`Circuit Breaker Check ${circuitBreakerChecks}:`, {
    isOpen: circuitState.isCircuitOpen,
    isHalfOpen: circuitState.isHalfOpen,
    consecutiveFailures: circuitState.consecutiveFailures,
    totalAttempts: circuitState.totalAttempts,
    failureRate:
      circuitState.totalAttempts > 0
        ? (
            circuitState.consecutiveFailures / circuitState.totalAttempts
          ).toFixed(2)
        : "0.00",
  });

  // Stop monitoring after 10 checks or if circuit opens
  if (circuitBreakerChecks >= 10 || circuitState.isCircuitOpen) {
    clearInterval(circuitBreakerInterval);
    console.log("✅ Circuit breaker monitoring completed");
  }
}, 2000);

// Test 4: Monitor event buffers
console.log("\n📊 Test 4: Event buffer monitoring");
let bufferChecks = 0;
const bufferInterval = setInterval(() => {
  const failedCount = telemetry.getFailedEventsCount();
  const queuedCount = telemetry.getQueuedEventsCount();
  const bufferedCount = telemetry.getBufferedEventsCount();
  bufferChecks++;

  console.log(`Buffer Check ${bufferChecks}:`, {
    failed: failedCount,
    queued: queuedCount,
    buffered: bufferedCount,
    total: failedCount + queuedCount + bufferedCount,
  });

  // Stop monitoring after 10 checks or if all events are processed
  if (bufferChecks >= 10 || failedCount + queuedCount + bufferedCount === 0) {
    clearInterval(bufferInterval);
    console.log("✅ Buffer monitoring completed");
  }
}, 2000);

// Test 5: Test user identification
console.log("\n👤 Test 5: User identification");
telemetry.identify("test-user-123", {
  name: "Test User",
  email: "test@example.com",
  plan: "premium",
});

// Test 6: Test custom events
console.log("\n🎯 Test 6: Custom events");
const customEventsPlugin = telemetry.getCustomEventsPlugin();
if (customEventsPlugin) {
  customEventsPlugin.track("button_click", {
    buttonId: "test-button",
    page: "test-page",
  });
}

// Test 7: Test graceful shutdown
console.log("\n🛑 Test 7: Graceful shutdown");
setTimeout(async () => {
  console.log("Initiating graceful shutdown...");
  try {
    await telemetry.shutdown();
    console.log("✅ Graceful shutdown completed successfully");
  } catch (error) {
    console.error("❌ Graceful shutdown failed:", error);
  }
}, 15000); // Wait 15 seconds for tests to complete

// Test 8: Validate configuration
console.log("\n⚙️ Test 8: Configuration validation");
const config = telemetry.getConfig();
console.log("Final configuration:", {
  batchSize: config.batchSize,
  flushInterval: config.flushInterval,
  maxRetries: config.maxRetries,
  retryDelay: config.retryDelay,
  maxRetryDelay: config.maxRetryDelay,
  connectionTimeout: config.connectionTimeout,
  requestTimeout: config.requestTimeout,
  circuitBreakerMaxFailures: config.circuitBreakerMaxFailures,
  circuitBreakerTimeout: config.circuitBreakerTimeout,
  circuitBreakerFailureThreshold: config.circuitBreakerFailureThreshold,
  hyperlookMaxBatchSize: config.hyperlookMaxBatchSize,
  hyperlookMaxPayloadSize: config.hyperlookMaxPayloadSize,
  samplingRate: config.samplingRate,
});

console.log("\n🎉 Reliability validation test completed!");
console.log("Expected results:");
console.log("- Circuit breaker should open after 3 failures");
console.log("- Events should be retried with exponential backoff");
console.log("- Failed events should be returned to buffer");
console.log("- Graceful shutdown should complete successfully");
