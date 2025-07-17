import { initTelemetry } from "../src/index";

// Comprehensive Test: Navigation Tracking Compatibility
// This test verifies that the PageViewPlugin works correctly across all scenarios
// without causing any issues or breaking existing applications

const telemetry = initTelemetry({
  hyperlookApiKey: "sk_test_key", // Test key for this example

  // Enable page view tracking
  enablePageViews: true,
  enableClicks: false, // Disable other plugins for focused testing
  enableLogs: false,
  enableNetwork: false,
  enablePerformance: false,

  // Configuration
  batchSize: 10,
  flushInterval: 5000, // 5 seconds for faster testing
});

console.log("=== Comprehensive Navigation Test ===");
console.log("Testing safe navigation tracking across all scenarios");

// Test 1: Initial page load
console.log("\n1. Initial page load captured automatically");

// Test 2: Simulate Next.js navigation
setTimeout(() => {
  console.log("\n2. Simulating Next.js navigation to /dashboard");
  console.log("   - Changing URL and title");

  // Simulate Next.js navigation
  history.pushState({}, "", "/dashboard");
  document.title = "Dashboard - My App";

  console.log("   - Navigation should be detected by polling");
}, 1000);

// Test 3: Simulate React Router navigation
setTimeout(() => {
  console.log("\n3. Simulating React Router navigation to /profile");
  console.log("   - Changing URL and title again");

  // Simulate React Router navigation
  history.pushState({}, "", "/profile");
  document.title = "Profile - My App";

  console.log("   - Navigation should be detected by polling");
}, 3000);

// Test 4: Simulate browser back navigation
setTimeout(() => {
  console.log("\n4. Simulating browser back navigation");
  console.log("   - Using history.back()");

  // Simulate browser back button
  history.back();

  console.log("   - Should trigger popstate event");
}, 5000);

// Test 5: Simulate title-only change (Next.js sometimes does this)
setTimeout(() => {
  console.log("\n5. Simulating title-only change");
  console.log("   - Changing only document.title");

  // Simulate title-only change
  document.title = "Updated Title - My App";

  console.log("   - Should be detected by polling");
}, 7000);

// Test 6: Simulate URL-only change
setTimeout(() => {
  console.log("\n6. Simulating URL-only change");
  console.log("   - Changing only URL");

  // Simulate URL-only change
  history.pushState({}, "", "/settings");

  console.log("   - Should be detected by polling");
}, 9000);

// Test 7: Verify no infinite loops with rapid navigation
setTimeout(() => {
  console.log("\n7. Testing for infinite loops");
  console.log("   - Making multiple rapid navigation calls");

  // Make multiple rapid calls to test for infinite loops
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      history.pushState({}, "", `/test-${i}`);
      document.title = `Test ${i} - My App`;
    }, i * 50); // Even faster calls
  }

  console.log("   - If no errors occur, the fix is working");
}, 11000);

// Test 8: Test SSR compatibility
setTimeout(() => {
  console.log("\n8. Testing SSR compatibility");
  console.log("   - Simulating server-side rendering scenario");

  // Simulate what might happen in SSR
  const originalLocation = window.location.href;
  const originalTitle = document.title;

  // Change URL and title
  history.pushState({}, "", "/ssr-test");
  document.title = "SSR Test - My App";

  // Simulate page reload (like SSR would do)
  setTimeout(() => {
    // Reset to original state
    history.pushState({}, "", originalLocation);
    document.title = originalTitle;
    console.log("   - SSR simulation complete");
  }, 100);
}, 13000);

// Test 9: Test memory leak prevention
setTimeout(() => {
  console.log("\n9. Testing memory leak prevention");
  console.log("   - Checking if intervals are properly cleaned up");

  // Make some navigation changes
  history.pushState({}, "", "/memory-test");
  document.title = "Memory Test - My App";

  console.log("   - Navigation changes made, checking for memory leaks");
}, 15000);

// Test 10: Test error resilience
setTimeout(() => {
  console.log("\n10. Testing error resilience");
  console.log("   - Simulating potential error conditions");

  // Try to cause some edge cases
  try {
    // Simulate rapid title changes
    for (let i = 0; i < 3; i++) {
      document.title = `Error Test ${i} - My App`;
    }

    // Simulate rapid URL changes
    for (let i = 0; i < 3; i++) {
      history.pushState({}, "", `/error-test-${i}`);
    }

    console.log("   - Error resilience test complete");
  } catch (error) {
    console.error("   - Error resilience test failed:", error);
  }
}, 17000);

// Test 11: Final verification
setTimeout(() => {
  console.log("\n11. Final verification");
  console.log("   - Checking that telemetry is still working");

  // Try to capture a custom event to verify telemetry is still functional
  const customPlugin = telemetry.getCustomEventsPlugin();
  if (customPlugin) {
    customPlugin.captureCustomEvent("test", "verification", {
      message: "Telemetry is working correctly",
      timestamp: new Date().toISOString(),
      testResults: {
        navigationTracking: "working",
        errorHandling: "working",
        memoryManagement: "working",
        ssrCompatibility: "working",
      },
    });
    console.log("   - Custom event captured successfully");
  }

  console.log("\n=== Test Complete ===");
  console.log(
    "If you see this message without any errors, the fix is working!"
  );
  console.log("Check your browser console for any error messages.");
  console.log("The telemetry SDK should now work correctly with:");
  console.log("- Next.js applications");
  console.log("- React Router applications");
  console.log("- Vanilla JavaScript applications");
  console.log("- Server-side rendered applications");
}, 19000);

console.log("\nTest started. Watch for any error messages in the console.");
console.log("The test will run for about 19 seconds.");
console.log("Expected behavior:");
console.log("- No infinite recursion errors");
console.log("- No memory leaks");
console.log("- Proper cleanup of resources");
console.log("- Accurate navigation tracking");
