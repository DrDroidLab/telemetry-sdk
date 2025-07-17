import { initTelemetry } from "../src/index";

// This example demonstrates how the SDK now captures network requests
// that are made before the SDK is initialized using the integrated approach

console.log("=== Early Initialization Test (Integrated Approach) ===");

// Make a network request BEFORE initializing the SDK
console.log("Making network request before SDK initialization...");
fetch("https://jsonplaceholder.typicode.com/posts/1")
  .then(response => response.json())
  .then(data => {
    console.log("Request completed before SDK init:", data.title);
  })
  .catch(error => {
    console.error("Request failed before SDK init:", error);
  });

// Make another request using XHR
if (typeof XMLHttpRequest !== "undefined") {
  console.log("Making XHR request before SDK initialization...");
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "https://jsonplaceholder.typicode.com/posts/2");
  xhr.onload = function () {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      console.log("XHR request completed before SDK init:", data.title);
    }
  };
  xhr.send();
}

// Wait a bit to ensure requests complete
setTimeout(() => {
  console.log("\nInitializing SDK...");

  // Now initialize the SDK
  const telemetry = initTelemetry({
    hyperlookApiKey: "test-api-key", // This will fail, but that's okay for testing
    enableNetwork: true, // Enable network tracking
    enableClicks: false, // Disable other plugins for focused testing
    enableLogs: false,
    enablePerformance: false,
    enablePageViews: false,

    // Configuration for testing
    batchSize: 10,
    flushInterval: 5000, // 5 seconds for faster testing
  });

  console.log("SDK initialized successfully!");
  console.log(
    "The network requests made before initialization should now be captured and processed."
  );

  // Make another request AFTER SDK initialization
  console.log("\nMaking network request after SDK initialization...");
  fetch("https://jsonplaceholder.typicode.com/posts/3")
    .then(response => response.json())
    .then(data => {
      console.log("Request completed after SDK init:", data.title);
    })
    .catch(error => {
      console.error("Request failed after SDK init:", error);
    });

  // Clean up after a delay
  setTimeout(() => {
    console.log("\nCleaning up...");
    telemetry.destroy();
    console.log("Test completed!");
  }, 10000);
}, 2000);
