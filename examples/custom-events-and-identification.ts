import { initTelemetry } from "../src";

// Initialize telemetry with custom events enabled
const telemetry = initTelemetry({
  hyperlookApiKey: "your-actual-hyperlook-api-key", // Replace with your actual API key
  enableCustomEvents: true,
  sessionId: "custom-session-123", // Optional: provide custom session ID
  userId: "user-456", // Optional: provide initial user ID
  batchSize: 10,
  flushInterval: 5000,
});

// Example 1: Identify a user with traits
telemetry.identify("user-789", {
  name: "John Doe",
  email: "john@example.com",
  plan: "premium",
  signupDate: "2024-01-15",
});

// Example 2: Capture custom events using the custom events plugin
const customPlugin = telemetry.getCustomEventsPlugin();
if (customPlugin) {
  // Capture a custom event with type, name, and payload
  customPlugin.captureCustomEvent("ecommerce", "product_viewed", {
    productId: "prod_123",
    productName: "Wireless Headphones",
    category: "Electronics",
    price: 99.99,
    currency: "USD",
  });

  // Capture another custom event
  customPlugin.captureCustomEvent("user_action", "feature_used", {
    feature: "dark_mode_toggle",
    page: "/settings",
    userAgent: navigator.userAgent,
  });

  // Capture a pre-built event object
  const customEvent = {
    eventType: "analytics",
    eventName: "page_view",
    payload: {
      page: "/dashboard",
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
    timestamp: new Date().toISOString(),
  };
  customPlugin.captureEvent(customEvent);
}

// Example 3: Regular events automatically get session and user context
telemetry.capture({
  eventType: "interaction",
  eventName: "button_click",
  payload: {
    buttonId: "submit-form",
    page: "/contact",
  },
  timestamp: new Date().toISOString(),
});

// Example 4: Get current session and user information
console.log("Current session ID:", telemetry.getSessionId());
console.log("Current user ID:", telemetry.getUserId());

// Example 5: Check event counts
console.log("Queued events:", telemetry.getQueuedEventsCount());
console.log("Buffered events:", telemetry.getBufferedEventsCount());
console.log("Failed events:", telemetry.getFailedEventsCount());

// Example 6: Retry failed events if any
telemetry.retryFailedEvents();

// Cleanup when done
setTimeout(async () => {
  await telemetry.shutdown();
  console.log("Telemetry shutdown complete");
}, 10000);
