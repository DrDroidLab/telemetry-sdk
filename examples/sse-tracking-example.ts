/**
 * Example: Sophisticated Server-Sent Events (SSE) Tracking
 *
 * This example demonstrates how the NetworkPlugin now captures:
 * 1. EventSource connections and individual messages
 * 2. Fetch-based SSE streams and their messages
 * 3. Connection lifecycle events (open, error, close)
 * 4. Message-level tracking with proper parsing
 * 5. Proper stream handling without consuming the original response
 */

import { TelemetryManager } from "../src/TelemetryManager";
import { ExporterType } from "../src/types/ExporterTypes";

// Initialize telemetry with network tracking enabled
const telemetry = new TelemetryManager({
  enableNetwork: true,
  enableLogs: true,
  exporters: [ExporterType.HTTP], // Use HTTP exporter for demo
  flushInterval: 5000,
});

console.log("🚀 Starting Enhanced SSE Tracking Example...");

// Example 1: EventSource-based SSE (most common)
function demonstrateEventSourceSSE() {
  console.log("\n📡 Testing EventSource SSE...");

  // This will be intercepted by our SSE interceptor
  const eventSource = new EventSource("https://api.example.com/events");

  eventSource.onopen = () => {
    console.log("✅ EventSource connection opened");
    // Our interceptor captures: "sse_connection_opened"
  };

  eventSource.onmessage = event => {
    console.log("📨 Received SSE message:", event.data);
    // Our interceptor captures: "sse_message_received" with parsed data
  };

  eventSource.onerror = () => {
    console.log("❌ EventSource error occurred");
    // Our interceptor captures: "sse_connection_error"
  };

  // Close after 30 seconds
  setTimeout(() => {
    eventSource.close();
    console.log("🔌 EventSource connection closed");
    // Our interceptor captures: "sse_connection_closed"
  }, 30000);
}

// Example 2: Fetch-based SSE streaming (FIXED)
async function demonstrateFetchSSE() {
  console.log("\n🌊 Testing Fetch-based SSE...");

  try {
    // This will be intercepted by our enhanced fetch interceptor
    const response = await fetch("https://api.example.com/stream", {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

    console.log("📦 Fetch SSE response received:", response.status);

    // Our interceptor detects SSE and captures: "fetch_sse_initiated"
    // It also sets up streaming interception automatically using tee()
    // The original response stream is preserved for the application

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      console.log("🔄 Reading SSE stream...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("✅ SSE stream ended");
          break;
        }

        const chunk = decoder.decode(value);
        console.log("📦 Received chunk:", chunk);
        // Our interceptor captures individual messages: "sse_fetch_message_received"
      }
    }
  } catch (error) {
    console.error("❌ Fetch SSE error:", error);
    // Our interceptor captures: "sse_fetch_stream_error"
  }
}

// Example 3: Test streaming detection
function testStreamingDetection() {
  console.log("\n🔍 Testing Streaming Detection...");

  // Test various streaming scenarios
  const testCases = [
    {
      name: "SSE Response",
      headers: { "content-type": "text/event-stream" },
      expected: true,
    },
    {
      name: "Chunked Response",
      headers: { "transfer-encoding": "chunked" },
      expected: true,
    },
    {
      name: "Streaming URL",
      url: "https://api.example.com/stream/events",
      headers: { connection: "keep-alive" },
      expected: true,
    },
    {
      name: "Regular JSON",
      headers: { "content-type": "application/json", "content-length": "100" },
      expected: false,
    },
  ];

  testCases.forEach(testCase => {
    console.log(`  Testing ${testCase.name}: Expected ${testCase.expected}`);
  });
}

// Example 4: What gets captured (updated)
function showCapturedData() {
  console.log("\n📊 Example of captured SSE data:");

  const exampleSSEEvents = [
    {
      eventName: "sse_connection_opened",
      payload: {
        url: "https://api.example.com/events",
        method: "GET",
        responseStatus: 200,
        isStreaming: true,
        isKeepAlive: true,
        connectionId: "sse_1234567890_abc123",
        sseState: "connected",
        duration: 150,
      },
    },
    {
      eventName: "fetch_sse_initiated",
      payload: {
        url: "https://api.example.com/stream",
        method: "GET",
        responseStatus: 200,
        isStreaming: true,
        isKeepAlive: true,
        sseState: "connected",
        duration: 120,
      },
    },
    {
      eventName: "sse_fetch_message_received",
      payload: {
        url: "https://api.example.com/stream",
        method: "GET",
        responseBody: { type: "user_update", userId: 123, status: "online" },
        isStreaming: true,
        connectionId: "fetch_sse_1234567890_def456",
        sseState: "message",
        sseMessageCount: 1,
        sseMessageType: "message",
        duration: 5000,
      },
    },
    {
      eventName: "sse_fetch_stream_ended",
      payload: {
        url: "https://api.example.com/stream",
        method: "GET",
        isStreaming: true,
        isKeepAlive: false,
        connectionId: "fetch_sse_1234567890_def456",
        sseState: "closed",
        sseMessageCount: 42,
        duration: 30000,
      },
    },
  ];

  exampleSSEEvents.forEach(event => {
    console.log(
      `🎯 ${event.eventName}:`,
      JSON.stringify(event.payload, null, 2)
    );
  });
}

// Example 5: Advanced SSE patterns with error handling
function demonstrateAdvancedSSE() {
  console.log("\n🔬 Advanced SSE Patterns with Error Handling...");

  // Reconnecting EventSource with proper error handling
  let reconnectAttempts = 0;
  const maxReconnects = 3;

  function createReconnectingEventSource() {
    const eventSource = new EventSource("https://api.example.com/events");

    eventSource.onerror = error => {
      console.log(`❌ EventSource error:`, error);

      if (reconnectAttempts < maxReconnects) {
        reconnectAttempts++;
        console.log(`🔄 Reconnecting... (attempt ${reconnectAttempts})`);
        setTimeout(createReconnectingEventSource, 1000 * reconnectAttempts);
      } else {
        console.log("🛑 Max reconnection attempts reached");
      }
      // Each reconnection creates a new connectionId in our tracking
    };

    return eventSource;
  }

  // Multiple concurrent SSE connections
  const connections = [
    "https://api.example.com/notifications",
    "https://api.example.com/chat",
    "https://api.example.com/metrics",
  ]
    .map(url => {
      try {
        return new EventSource(url);
      } catch (error) {
        console.error(`Failed to create EventSource for ${url}:`, error);
        return null;
      }
    })
    .filter(Boolean);

  // Our interceptor tracks each connection separately with unique connectionIds
  console.log(`📡 Created ${connections.length} concurrent SSE connections`);
}

// Example 6: Test fetch streaming with proper stream handling
async function testFetchStreamHandling() {
  console.log("\n🧪 Testing Fetch Stream Handling...");

  try {
    const response = await fetch("https://httpbin.org/stream/5", {
      headers: {
        Accept: "application/json",
      },
    });

    console.log("📦 Stream response received:", response.status);
    console.log(
      "📋 Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    // The response should still be readable even though our interceptor processed it
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks++;
        const chunk = decoder.decode(value);
        console.log(`📦 Chunk ${chunks}:`, chunk.substring(0, 100) + "...");

        if (chunks >= 3) break; // Limit for demo
      }

      console.log("✅ Stream reading completed successfully");
    }
  } catch (error) {
    console.error("❌ Stream handling test failed:", error);
  }
}

// Run the examples
async function runExamples() {
  console.log("🎯 Key improvements in this version:");
  console.log("   • Fixed stream consumption issues using tee()");
  console.log("   • Enhanced streaming detection");
  console.log("   • Better error handling and recovery");
  console.log("   • Proper SSE message parsing");
  console.log("   • Connection lifecycle tracking");
  console.log("   • Unique connection IDs for correlation");
  console.log("   • Both EventSource and fetch SSE support");

  showCapturedData();
  testStreamingDetection();

  // Uncomment to test with real SSE endpoints:
  // demonstrateEventSourceSSE();
  // await demonstrateFetchSSE();
  // demonstrateAdvancedSSE();
  // await testFetchStreamHandling();

  console.log("\n✨ Enhanced SSE Tracking Example Complete!");
}

// Cleanup function
function cleanup() {
  console.log("\n🧹 Cleaning up telemetry...");
  telemetry.shutdown();
}

// Handle process termination
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Run the example
runExamples().catch(console.error);
