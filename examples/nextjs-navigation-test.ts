import { initTelemetry } from "../src/index";

// Test: Next.js Navigation Compatibility
// This test verifies that the PageViewPlugin works correctly with Next.js
// without causing infinite recursion or interfering with routing

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

console.log("=== Next.js Navigation Test ===");
console.log(
  "Testing safe navigation tracking that doesn't interfere with Next.js routing"
);

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

// Test 3: Simulate another navigation
setTimeout(() => {
  console.log("\n3. Simulating Next.js navigation to /profile");
  console.log("   - Changing URL and title again");

  // Simulate another Next.js navigation
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

// Test 6: Verify no infinite loops
setTimeout(() => {
  console.log("\n6. Testing for infinite loops");
  console.log("   - Making multiple rapid navigation calls");

  // Make multiple rapid calls to test for infinite loops
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      history.pushState({}, "", `/test-${i}`);
      document.title = `Test ${i} - My App`;
    }, i * 100);
  }

  console.log("   - If no errors occur, the fix is working");
}, 9000);

// Test 7: Final verification
setTimeout(() => {
  console.log("\n7. Final verification");
  console.log("   - Checking that telemetry is still working");

  // Try to capture a custom event to verify telemetry is still functional
  const customPlugin = telemetry.getCustomEventsPlugin();
  if (customPlugin) {
    customPlugin.captureCustomEvent("test", "verification", {
      message: "Telemetry is working correctly",
      timestamp: new Date().toISOString(),
    });
    console.log("   - Custom event captured successfully");
  }

  console.log("\n=== Test Complete ===");
  console.log(
    "If you see this message without any errors, the fix is working!"
  );
  console.log("Check your browser console for any error messages.");
}, 12000);

console.log("\nTest started. Watch for any error messages in the console.");
console.log("The test will run for about 12 seconds.");
