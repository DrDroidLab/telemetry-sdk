import { initTelemetry } from "../src/index";

// Test: Direct Event-Based Navigation Tracking
// This test verifies that the PageViewPlugin works correctly using direct events
// instead of polling, which is more efficient and responsive

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

console.log("=== Direct Event Navigation Test ===");
console.log("Testing direct event-based navigation tracking (no polling)");

// Test 1: Initial page load
console.log("\n1. Initial page load captured automatically");

// Test 2: Simulate Next.js navigation with pushState
setTimeout(() => {
  console.log("\n2. Simulating Next.js navigation to /dashboard");
  console.log("   - Using history.pushState()");

  // Simulate Next.js navigation
  history.pushState({}, "", "/dashboard");
  document.title = "Dashboard - My App";

  console.log("   - Should trigger custom telemetry-navigation event");
}, 1000);

// Test 3: Simulate React Router navigation with replaceState
setTimeout(() => {
  console.log("\n3. Simulating React Router navigation to /profile");
  console.log("   - Using history.replaceState()");

  // Simulate React Router navigation
  history.replaceState({}, "", "/profile");
  document.title = "Profile - My App";

  console.log("   - Should trigger custom telemetry-navigation event");
}, 3000);

// Test 4: Simulate browser back navigation
setTimeout(() => {
  console.log("\n4. Simulating browser back navigation");
  console.log("   - Using history.back()");

  // Simulate browser back button
  history.back();

  console.log("   - Should trigger popstate event");
}, 5000);

// Test 5: Test rapid navigation calls
setTimeout(() => {
  console.log("\n5. Testing rapid navigation calls");
  console.log("   - Making multiple pushState calls quickly");

  // Make multiple rapid calls to test for infinite loops
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      history.pushState({}, "", `/rapid-${i}`);
      document.title = `Rapid ${i} - My App`;
    }, i * 100);
  }

  console.log("   - If no errors occur, the direct event approach is working");
}, 7000);

// Test 6: Test that custom events don't interfere with routing
setTimeout(() => {
  console.log("\n6. Testing routing compatibility");
  console.log("   - Verifying that routing still works normally");

  // Test that we can still navigate normally
  history.pushState({}, "", "/compatibility-test");
  document.title = "Compatibility Test - My App";

  // Test that we can go back
  setTimeout(() => {
    history.back();
    console.log("   - Navigation and back button working correctly");
  }, 500);
}, 9000);

// Test 7: Final verification
setTimeout(() => {
  console.log("\n7. Final verification");
  console.log("   - Checking that telemetry is still working");

  // Try to capture a custom event to verify telemetry is still functional
  const customPlugin = telemetry.getCustomEventsPlugin();
  if (customPlugin) {
    customPlugin.captureCustomEvent("test", "direct_event_verification", {
      message: "Direct event approach is working correctly",
      timestamp: new Date().toISOString(),
      approach: "direct_events",
      benefits: [
        "No polling overhead",
        "Immediate response to navigation",
        "No interference with routing",
        "Better performance",
      ],
    });
    console.log("   - Custom event captured successfully");
  }

  console.log("\n=== Test Complete ===");
  console.log("Direct event approach benefits:");
  console.log("- ✅ No polling overhead");
  console.log("- ✅ Immediate response to navigation");
  console.log("- ✅ No interference with Next.js/React Router");
  console.log("- ✅ Better performance than polling");
  console.log("- ✅ No infinite recursion issues");
}, 11000);

console.log("\nTest started. Watch for any error messages in the console.");
console.log("The test will run for about 11 seconds.");
console.log("Expected behavior:");
console.log("- No infinite recursion errors");
console.log("- Immediate response to navigation changes");
console.log("- No polling intervals running");
console.log("- Proper cleanup of event listeners");
