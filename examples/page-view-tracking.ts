import { initTelemetry } from "../src/index";

// Example: Page View Tracking
// This example shows how the telemetry SDK automatically captures page_hit events
// when someone first visits a page, similar to your TelemetryTracker implementation

const telemetry = initTelemetry({
  hyperlookApiKey: "sk_your-api-key", // Replace with your actual API key

  // Page view tracking is enabled by default
  enablePageViews: true, // This will capture page_hit events

  // Other tracking options
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,

  // Configuration
  batchSize: 50,
  flushInterval: 10000, // 10 seconds
});

// The SDK will automatically capture a page_hit event when the page loads
// This event includes:
// - eventType: "page"
// - eventName: "page_hit"
// - payload: {
//     viewport: { width, height, devicePixelRatio },
//     characterSet, language, cookieEnabled, onLine, platform,
//     userAgent, referrer, url, title
//   }

console.log("Page view tracking initialized!");
console.log(
  "A page_hit event will be automatically captured when this page loads."
);

// You can also manually capture page view events if needed
telemetry.capture({
  eventType: "page",
  eventName: "page_hit",
  payload: {
    customProperty: "manual_page_hit",
    timestamp: new Date().toISOString(),
  },
  timestamp: new Date().toISOString(),
});

// The page_hit event will be sent to Hyperlook with the same format as your TelemetryTracker:
// - Same event structure
// - Same URL: https://ingest.hyperlook.io/events/batch
// - Same API key format
// - Same batching and retry logic
