/**
 * Session Replay Export Example
 *
 * This example demonstrates how to configure and use the session replay feature
 * to capture user interactions and export them to Hyperlook.
 *
 * HOW TO USE SESSION REPLAY DATA FOR REPLAY:
 *
 * 1. The session replay events are exported to Hyperlook with the following structure:
 *    - event_type: "session_replay"
 *    - event_name: "session_replay"
 *    - properties.rrweb_type: "session_start" | "events_batch" | "session_end"
 *    - properties.events: Array of rrweb events for replay
 *    - properties.metadata: Session metadata (startTime, duration, etc.)
 *    - properties.config: Session replay configuration
 *    - properties.sessionId: Unique session identifier
 *
 * 2. To replay a session in your application:
 *    a) Find all events with the same sessionId
 *    b) Sort them by timestamp
 *    c) Use the rrweb library to replay the events:
 *       - Start with "session_start" event
 *       - Apply "events_batch" events in order
 *       - End with "session_end" event
 *
 * 3. Example replay code:
 *    ```javascript
 *    import { replay } from 'rrweb';
 *
 *    // Get session events from Hyperlook
 *    const sessionEvents = await getSessionEvents(sessionId);
 *
 *    // Extract rrweb events from all batches
 *    const rrwebEvents = [];
 *    sessionEvents.forEach(event => {
 *      if (event.properties.events) {
 *        rrwebEvents.push(...event.properties.events);
 *      }
 *    });
 *
 *    // Replay the session
 *    const replayer = new replay(rrwebEvents, {
 *      root: document.getElementById('replay-container')
 *    });
 *    replayer.play();
 *    ```
 */

import { initTelemetry } from "../src";
import { ExporterType } from "../src/types/ExporterTypes";

console.log("🚀 Starting Session Replay Export Example...");

// Example 1: Basic Session Replay with HTTP Export
function demonstrateHTTPExport() {
  console.log("\n📡 Session Replay with HTTP Export...");

  const telemetry = initTelemetry({
    exporters: [ExporterType.HTTP],
    endpoint: "https://your-api.com/session-replay",

    enableSessionReplay: true,
    sessionReplay: {
      maskTextInputs: true,
      maxEvents: 5000,
      maxDuration: 15 * 60 * 1000, // 15 minutes
      batchSize: 25,
    },

    batchSize: 25,
    flushInterval: 10000,
    enableLogs: true,
  });

  console.log("✅ HTTP export session replay initialized");
  return telemetry;
}

// Example 2: Session Replay with Hyperlook Export
function demonstrateHyperlookExport() {
  console.log("\n🔗 Session Replay with Hyperlook Export...");

  const telemetry = initTelemetry({
    exporters: [ExporterType.HYPERLOOK],
    hyperlookApiKey: "your-hyperlook-api-key",

    enableSessionReplay: true,
    sessionReplay: {
      maskTextInputs: true,
      maxEvents: 10000,
      maxDuration: 30 * 60 * 1000, // 30 minutes
      batchSize: 50,
    },

    enableLogs: true,
  });

  console.log("✅ Hyperlook export session replay initialized");
  return telemetry;
}

// Example 3: Dual Export (HTTP + Hyperlook)
function demonstrateDualExport() {
  console.log("\n🔄 Session Replay with Dual Export...");

  const telemetry = initTelemetry({
    exporters: [ExporterType.HTTP, ExporterType.HYPERLOOK],
    endpoint: "https://your-api.com/session-replay",
    hyperlookApiKey: "your-hyperlook-api-key",

    enableSessionReplay: true,
    sessionReplay: {
      maskTextInputs: true,
      maxEvents: 5000,
      maxDuration: 15 * 60 * 1000,
      batchSize: 25,
    },

    batchSize: 25,
    flushInterval: 10000,
    enableLogs: true,
  });

  console.log("✅ Dual export session replay initialized");
  return telemetry;
}

// Example 4: Privacy-First Configuration
function demonstratePrivacyFirst() {
  console.log("\n🔒 Privacy-First Session Replay...");

  const telemetry = initTelemetry({
    exporters: [ExporterType.HTTP],
    endpoint: "https://your-api.com/session-replay",

    enableSessionReplay: true,
    sessionReplay: {
      maskTextInputs: true,
      maskAllInputs: true,
      maskTextSelector:
        'input[type="password"], input[type="email"], .sensitive, .private',
      blockClass: "no-record",
      ignoreClass: "ignore-replay",
      maxEvents: 3000,
      maxDuration: 10 * 60 * 1000, // 10 minutes
      batchSize: 10,
    },

    batchSize: 10,
    flushInterval: 5000,
    enableLogs: true,
  });

  console.log("✅ Privacy-first session replay initialized");
  return telemetry;
}

// Example 5: Performance-Optimized Configuration
function demonstratePerformanceOptimized() {
  console.log("\n⚡ Performance-Optimized Session Replay...");

  const telemetry = initTelemetry({
    exporters: [ExporterType.HYPERLOOK],
    hyperlookApiKey: "your-hyperlook-api-key",

    enableSessionReplay: true,
    sessionReplay: {
      recordCanvas: false,
      collectFonts: false,
      throttleEvents: true,
      throttleDelay: 100,
      checkoutEveryNms: 10000, // 10 seconds
      checkoutEveryNth: 1000,
      maxEvents: 20000,
      maxDuration: 60 * 60 * 1000, // 1 hour
      batchSize: 100,
    },

    enableLogs: true,
  });

  console.log("✅ Performance-optimized session replay initialized");
  return telemetry;
}

// Example 6: Simple Test with Logging
function demonstrateSimpleTest() {
  console.log("\n🧪 Simple Session Replay Test with Logging...");

  const telemetry = initTelemetry({
    exporters: [ExporterType.HTTP],
    endpoint: "https://your-api.com/session-replay",

    enableSessionReplay: true,
    sessionReplay: {
      maskTextInputs: true,
      maxEvents: 1000, // Small limit for testing
      maxDuration: 5 * 60 * 1000, // 5 minutes
      batchSize: 10, // Small batches for testing
    },

    batchSize: 10,
    flushInterval: 5000,
    enableLogs: true,
    logging: {
      enableConsole: true, // Enable console logging to see all logs
    },
  });

  console.log("✅ Simple test session replay initialized");
  console.log("📝 Check the browser console for detailed session replay logs!");
  console.log("🔍 You should see logs like:");
  console.log("   • SessionReplayPlugin constructor called");
  console.log("   • SessionReplayPlugin setup started");
  console.log("   • SessionReplayPlugin recording started");
  console.log("   • SessionReplayPlugin processing rrweb event");
  console.log("   • SessionReplayPlugin exporting event batch");

  return telemetry;
}

// Simulate user interactions to generate events
function simulateUserInteractions(telemetry: any) {
  console.log("\n🎯 Simulating user interactions...");

  // Simulate clicks
  setTimeout(() => {
    console.log("   • User clicked on button");
    document.body.innerHTML = '<button id="test-btn">Click me</button>';
    document.getElementById("test-btn")?.click();
  }, 1000);

  // Simulate form input
  setTimeout(() => {
    console.log("   • User filled form");
    document.body.innerHTML = '<input type="text" placeholder="Enter name" />';
    const input = document.querySelector("input");
    if (input) {
      input.value = "John Doe";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, 2000);

  // Simulate scroll
  setTimeout(() => {
    console.log("   • User scrolled page");
    window.scrollTo(0, 100);
  }, 3000);

  // Simulate navigation
  setTimeout(() => {
    console.log("   • User navigated to new page");
    window.history.pushState({}, "", "/new-page");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, 4000);
}

// Main execution
async function main() {
  try {
    // Choose which example to run
    const example = process.argv[2] || "simple";

    let telemetry: any;

    switch (example) {
      case "http":
        telemetry = demonstrateHTTPExport();
        break;
      case "hyperlook":
        telemetry = demonstrateHyperlookExport();
        break;
      case "dual":
        telemetry = demonstrateDualExport();
        break;
      case "privacy":
        telemetry = demonstratePrivacyFirst();
        break;
      case "performance":
        telemetry = demonstratePerformanceOptimized();
        break;
      case "simple":
      default:
        telemetry = demonstrateSimpleTest();
    }

    // Simulate user interactions
    simulateUserInteractions(telemetry);

    // Keep the process alive for a bit to capture events
    setTimeout(async () => {
      console.log("\n🛑 Shutting down telemetry...");
      await telemetry.shutdown();
      console.log("✅ Session replay example completed");
      console.log(
        "📊 Check the console logs above to see the session replay activity!"
      );
      process.exit(0);
    }, 10000);
  } catch (error) {
    console.error("❌ Error in session replay example:", error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main();
}

export {
  demonstrateHTTPExport,
  demonstrateHyperlookExport,
  demonstrateDualExport,
  demonstratePrivacyFirst,
  demonstratePerformanceOptimized,
  demonstrateSimpleTest,
};
