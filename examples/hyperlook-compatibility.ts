import { TelemetryManager } from "../src/TelemetryManager";

// This example shows how to configure the telemetry SDK to match
// the TelemetryTracker format exactly

const manager = new TelemetryManager({
  hyperlookApiKey: "sk_your-api-key", // your api key
  enableClicks: true, // Captures click events with rich data
  enableLogs: true, // Captures console events (log, warn, error, info, debug)
  enableNetwork: true, // Captures network events (fetch, xhr) with Supabase detection
  enablePerformance: true, // Captures page load metrics
  batchSize: 50, // Same as TelemetryTracker
  flushInterval: 10000, // Same as TelemetryTracker
});

// The SDK will now send events in the exact same format as TelemetryTracker:
// - Same event types: page, interaction, console, error, network, supabase
// - Same event names: page_load, page_hit, click, console_log, console_warn, etc.
// - Same data structure with all the same properties
// - Same URL: https://ingest.hyperlook.io/events/batch
// - Your API key: sk_your-api-key

console.log("Telemetry SDK initialized with Hyperlook compatibility");

// Test some events
console.log("This will be captured as console_log");
console.warn("This will be captured as console_warn");
console.error("This will be captured as console_error");

// Simulate a network request
fetch("https://api.example.com/data")
  .then(() => console.log("Fetch completed"))
  .catch(() => console.log("Fetch failed"));

// Simulate a Supabase request
fetch("https://supabase.co/rest/v1/users")
  .then(() => console.log("Supabase request completed"))
  .catch(() => console.log("Supabase request failed"));

// The SDK will automatically capture:
// - Page load metrics when the page loads
// - Click events with rich element data
// - Network requests (including Supabase detection)
// - Console logs with stack traces
// - JavaScript errors and unhandled promise rejections
