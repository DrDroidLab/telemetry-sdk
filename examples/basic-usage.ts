import { initTelemetry } from "../src/index";

// Basic telemetry initialization
const telemetry = initTelemetry({
  endpoint: "https://your-api.com/telemetry",
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
});

// The SDK automatically starts collecting data
console.log("Telemetry initialized successfully!");

// Example: Capture a custom event
telemetry.capture({
  eventType: "custom",
  eventName: "user_registration",
  payload: {
    userId: "12345",
    registrationMethod: "email",
    source: "landing_page",
  },
  timestamp: new Date().toISOString(),
});

// Example: Monitor telemetry state
setInterval(() => {
  const failedCount = telemetry.getFailedEventsCount();
  const queuedCount = telemetry.getQueuedEventsCount();
  const bufferedCount = telemetry.getBufferedEventsCount();

  console.log(
    `Telemetry Status: Failed=${failedCount}, Queued=${queuedCount}, Buffered=${bufferedCount}`
  );
}, 5000);

// Example: Graceful shutdown
window.addEventListener("beforeunload", async () => {
  await telemetry.shutdown();
});
