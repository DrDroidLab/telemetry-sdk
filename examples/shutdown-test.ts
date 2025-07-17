import { initTelemetry } from "../src/index";

console.log("Starting telemetry shutdown test...");

// Initialize telemetry with a short flush interval for testing
const telemetry = initTelemetry({
  hyperlookApiKey: "test-api-key", // This will fail, but that's okay for testing
  flushInterval: 5000, // Flush every 5 seconds
  batchSize: 10, // Small batch size for testing
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
});

console.log("Telemetry initialized successfully!");

// Capture some test events
for (let i = 0; i < 15; i++) {
  telemetry.capture({
    eventType: "test",
    eventName: "shutdown_test_event",
    payload: {
      eventNumber: i,
      timestamp: new Date().toISOString(),
      message: `Test event ${i} for shutdown verification`,
    },
    timestamp: new Date().toISOString(),
  });
}

console.log("Captured 15 test events");

// Monitor telemetry state
const monitorInterval = setInterval(() => {
  const failedCount = telemetry.getFailedEventsCount();
  const queuedCount = telemetry.getQueuedEventsCount();
  const bufferedCount = telemetry.getBufferedEventsCount();
  const state = telemetry.getState();

  console.log(
    `Telemetry Status: State=${state}, Failed=${failedCount}, Queued=${queuedCount}, Buffered=${bufferedCount}`
  );

  // Stop monitoring after 30 seconds
  if (Date.now() > Date.now() + 30000) {
    clearInterval(monitorInterval);
  }
}, 2000);

// Test manual shutdown after 10 seconds
setTimeout(async () => {
  console.log("Testing manual shutdown...");
  try {
    await telemetry.shutdown();
    console.log("Manual shutdown completed successfully!");
  } catch (error) {
    console.error("Manual shutdown failed:", error);
  }
}, 10000);

// Test automatic shutdown by simulating page unload after 20 seconds
setTimeout(() => {
  console.log("Simulating page unload event...");
  if (typeof window !== "undefined") {
    // Simulate beforeunload event
    const beforeUnloadEvent = new Event("beforeunload");
    window.dispatchEvent(beforeUnloadEvent);

    // Simulate pagehide event
    const pageHideEvent = new Event("pagehide");
    window.dispatchEvent(pageHideEvent);
  } else if (typeof process !== "undefined") {
    // Simulate SIGTERM signal
    console.log("Simulating SIGTERM signal...");
    process.emit("SIGTERM");
  }
}, 20000);

console.log("Shutdown test setup complete. The test will run for 30 seconds.");
console.log(
  "You should see events being flushed and the telemetry shutting down gracefully."
);
