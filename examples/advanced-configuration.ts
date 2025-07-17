import { initTelemetry, LogLevel } from "../src/index";

// Advanced telemetry configuration
const telemetry = initTelemetry({
  // Event batching configuration
  batchSize: 25, // Smaller batch size for more frequent sends
  flushInterval: 15000, // Flush every 15 seconds

  // Retry configuration
  maxRetries: 5, // More retries for reliability
  retryDelay: 2000, // Longer delay between retries

  // Sampling configuration (only capture 5% of events)
  samplingRate: 0.05, // Useful for high-traffic applications

  // Plugin configuration
  enableClicks: true, // Track user clicks
  enableLogs: true, // Track console logs
  enableNetwork: true, // Track HTTP requests
  enablePerformance: true, // Track performance metrics

  // Advanced logging configuration
  logging: {
    level: LogLevel.DEBUG, // More verbose logging for development
    enableConsole: true, // Enable console output
    enableTimestamp: true, // Include timestamps
    prefix: "[MyApp Telemetry]", // Custom prefix
    formatter: (level, message, meta) => {
      // Custom log formatter
      return `[${new Date().toISOString()}] [${level}] ${message} ${
        meta ? JSON.stringify(meta) : ""
      }`;
    },
  },
});

console.log("Advanced telemetry configuration initialized!");

// Example: Custom event with typed payload
interface UserActionPayload {
  action: string;
  elementId: string;
  userId: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

telemetry.capture({
  eventType: "user_interaction",
  eventName: "form_submission",
  payload: {
    action: "submit",
    elementId: "contact-form",
    userId: "user-123",
    sessionId: "session-456",
    metadata: {
      formType: "contact",
      fields: ["name", "email", "message"],
    },
  } as UserActionPayload,
  timestamp: new Date().toISOString(),
});

// Example: Error handling and recovery
let retryAttempts = 0;
const maxRetryAttempts = 3;

const retryFailedEvents = async () => {
  if (retryAttempts >= maxRetryAttempts) {
    console.warn("Max retry attempts reached, giving up on failed events");
    return;
  }

  try {
    await telemetry.retryFailedEvents();
    console.log("Successfully retried failed events");
  } catch (error) {
    retryAttempts++;
    console.error(`Retry attempt ${retryAttempts} failed:`, error);

    // Schedule next retry with exponential backoff
    setTimeout(retryFailedEvents, Math.pow(2, retryAttempts) * 1000);
  }
};

// Example: Network status monitoring
let isOnline = navigator.onLine;

window.addEventListener("online", () => {
  isOnline = true;
  console.log("Network restored, retrying failed events...");
  retryFailedEvents();
});

window.addEventListener("offline", () => {
  isOnline = false;
  console.log("Network lost, events will be queued");
});

// Example: Performance monitoring
setInterval(() => {
  const failedCount = telemetry.getFailedEventsCount();
  const queuedCount = telemetry.getQueuedEventsCount();
  const bufferedCount = telemetry.getBufferedEventsCount();

  // Log performance metrics
  console.log("Telemetry Performance:", {
    failedEvents: failedCount,
    queuedEvents: queuedCount,
    bufferedEvents: bufferedCount,
    networkStatus: isOnline ? "online" : "offline",
    // Use (performance as any).memory for non-standard property
    memoryUsage: (performance as any).memory
      ? {
          used: Math.round(
            (performance as any).memory.usedJSHeapSize / 1024 / 1024
          ),
          total: Math.round(
            (performance as any).memory.totalJSHeapSize / 1024 / 1024
          ),
        }
      : "not available",
  });

  // Alert if too many failed events
  if (failedCount > 100) {
    console.warn("High number of failed events detected:", failedCount);
  }
}, 10000);

// Example: Graceful shutdown with timeout
const gracefulShutdown = async () => {
  console.log("Starting graceful shutdown...");

  // Set a timeout for shutdown
  const shutdownTimeout = setTimeout(() => {
    console.warn("Shutdown timeout reached, forcing destroy");
    telemetry.destroy();
  }, 10000); // 10 second timeout

  try {
    await telemetry.shutdown();
    clearTimeout(shutdownTimeout);
    console.log("Graceful shutdown completed");
  } catch (error) {
    console.error("Shutdown failed:", error);
    telemetry.destroy();
  }
};

// Register shutdown handlers
window.addEventListener("beforeunload", gracefulShutdown);
window.addEventListener("pagehide", gracefulShutdown);

// Handle unhandled errors
window.addEventListener("error", event => {
  telemetry.capture({
    eventType: "error",
    eventName: "unhandled_error",
    payload: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack,
    },
    timestamp: new Date().toISOString(),
  });
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", event => {
  telemetry.capture({
    eventType: "error",
    eventName: "unhandled_promise_rejection",
    payload: {
      reason: event.reason,
      promise: event.promise,
    },
    timestamp: new Date().toISOString(),
  });
});
