import { initTelemetry } from "../src/index";

// Example: TelemetryTracker Compatibility
// This example demonstrates how the updated SDK now matches the TelemetryTracker format
// for page hits, network events, and error events.

const telemetry = initTelemetry({
  hyperlookApiKey: "your-api-key", // Replace with your actual Hyperlook API key

  // All tracking enabled by default to match TelemetryTracker behavior
  enablePageViews: true,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableErrors: true,

  // Configuration matching TelemetryTracker
  batchSize: 50,
  flushInterval: 10000, // 10 seconds
});

console.log("Telemetry SDK initialized with TelemetryTracker compatibility!");

// The SDK will automatically capture events in the same format as TelemetryTracker:

// 1. Page Hits (page_hit events)
// - eventType: "page"
// - eventName: "page_hit"
// - payload includes: viewport, characterSet, language, cookieEnabled, onLine, platform, userAgent, referrer, url, title

// 2. Network Events (XHR and Fetch)
// - eventType: "network" or "supabase"
// - eventName: "xhr_complete", "fetch_complete", "supabase_xhr_complete", "supabase_fetch_complete"
// - payload includes: url, method, queryParams, responseStatus, responseStatusText, responseHeaders, responseBody, duration, startTime, endTime, isSupabaseQuery

// 3. Error Events
// - eventType: "error"
// - eventName: "javascript_error", "unhandled_promise_rejection"
// - payload includes: message, filename, lineno, colno, error, stack

// 4. Performance Events (page_load)
// - eventType: "page"
// - eventName: "page_load"
// - payload includes: all navigation timing metrics, web vitals, resource timing

// 5. Console Events
// - eventType: "console"
// - eventName: "console_log", "console_warn", "console_error", "console_info", "console_debug"
// - payload includes: message, args, stack

// 6. Click Events
// - eventType: "interaction"
// - eventName: "click"
// - payload includes: element details, position, boundingRect, event details, scroll position

// Test network events
setTimeout(() => {
  console.log("Testing network events...");

  // Test fetch request
  fetch("https://jsonplaceholder.typicode.com/posts/1")
    .then(response => response.json())
    .then(data => {
      console.log("Fetch test completed:", data.title);
    })
    .catch(error => {
      console.error("Fetch test failed:", error);
    });

  // Test XHR request
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "https://jsonplaceholder.typicode.com/posts/2");
  xhr.onload = function () {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      console.log("XHR test completed:", data.title);
    }
  };
  xhr.onerror = function () {
    console.error("XHR test failed");
  };
  xhr.send();
}, 2000);

// Test error events
setTimeout(() => {
  console.log("Testing error events...");

  // Test JavaScript error
  try {
    throw new Error("Test JavaScript error");
  } catch (error) {
    console.error("Caught error:", error);
  }

  // Test unhandled promise rejection
  Promise.reject(new Error("Test unhandled promise rejection"));
}, 4000);

// Test console events
setTimeout(() => {
  console.log("Testing console events...");

  console.log("This is a test log message");
  console.warn("This is a test warning message");
  console.error("This is a test error message");
  console.info("This is a test info message");
  console.debug("This is a test debug message");
}, 6000);

// Test click events
setTimeout(() => {
  console.log("Testing click events...");

  // Create a test button and click it
  const testButton = document.createElement("button");
  testButton.id = "test-button";
  testButton.textContent = "Test Button";
  testButton.style.position = "fixed";
  testButton.style.top = "10px";
  testButton.style.right = "10px";
  testButton.style.zIndex = "9999";
  document.body.appendChild(testButton);

  // Simulate a click
  testButton.click();

  // Remove the button after a delay
  setTimeout(() => {
    document.body.removeChild(testButton);
  }, 1000);
}, 8000);

console.log(
  "All tests will be executed automatically. Check the browser console for results."
);
console.log(
  "Events will be sent to Hyperlook in the same format as TelemetryTracker."
);
