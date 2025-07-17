import { initTelemetry } from "../src/index";

// Example: React/Next.js Navigation Tracking
// This example demonstrates how the enhanced PageViewPlugin now captures
// page view events on client-side navigation in addition to initial page loads
// The plugin uses a safe polling approach that doesn't interfere with Next.js routing

const telemetry = initTelemetry({
  hyperlookApiKey: "sk_your-api-key", // Replace with your actual API key

  // Page view tracking is enabled by default
  enablePageViews: true, // This will capture page_hit events for both initial loads and navigation

  // Other tracking options
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,

  // Configuration
  batchSize: 50,
  flushInterval: 10000, // 10 seconds
});

console.log("Enhanced page view tracking initialized!");
console.log("The plugin will automatically capture navigation events for:");
console.log("1. Initial page loads");
console.log("2. React Router navigation (URL/title changes)");
console.log("3. Next.js client-side routing");
console.log("4. Browser back/forward navigation (popstate)");

// Simulate React Router navigation (for testing purposes)
setTimeout(() => {
  console.log("Simulating React Router navigation to /dashboard...");

  // Simulate a React Router navigation
  history.pushState({}, "", "/dashboard");
  document.title = "Dashboard - My App";

  // The PageViewPlugin will automatically capture this navigation
  // and send a page_hit event to Hyperlook with isNavigation: true
}, 2000);

// Simulate another navigation
setTimeout(() => {
  console.log("Simulating React Router navigation to /profile...");

  // Simulate another React Router navigation
  history.pushState({}, "", "/profile");
  document.title = "Profile - My App";

  // Another page_hit event will be captured
}, 4000);

// Simulate browser back navigation
setTimeout(() => {
  console.log("Simulating browser back navigation...");

  // Simulate browser back button
  history.back();

  // Another page_hit event will be captured
}, 6000);

// Test with Next.js-style navigation (just changing URL and title)
setTimeout(() => {
  console.log("Simulating Next.js navigation to /settings...");

  // Simulate Next.js navigation by changing URL and title
  history.pushState({}, "", "/settings");
  document.title = "Settings - My App";

  // The plugin will detect both URL and title changes
}, 8000);

console.log(
  "Navigation tests will run automatically. Check your Hyperlook dashboard for events!"
);
