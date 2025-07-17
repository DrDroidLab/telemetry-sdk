import { initTelemetry } from "../src/index";

// Example: React/Next.js Navigation Tracking
// This example demonstrates how the enhanced PageViewPlugin now captures
// page view events on client-side navigation in addition to initial page loads

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
console.log("The SDK will now capture page_hit events for:");
console.log("1. Initial page load");
console.log("2. React Router navigation (pushState/replaceState)");
console.log("3. Browser back/forward navigation (popstate)");

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

// The enhanced PageViewPlugin now captures:
// - eventType: "page"
// - eventName: "page_hit"
// - payload: {
//     viewport: { width, height, devicePixelRatio },
//     characterSet, language, cookieEnabled, onLine, platform,
//     userAgent, referrer, url, title, isNavigation: true/false
//   }

// Key improvements:
// 1. Tracks client-side navigation in React/Next.js apps
// 2. Prevents duplicate events for the same URL
// 3. Includes isNavigation flag to distinguish initial loads from navigation
// 4. Works with React Router, Next.js router, and browser navigation
// 5. Automatically sends events to Hyperlook for storage and analysis
