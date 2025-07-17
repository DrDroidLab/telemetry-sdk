# Telemetry SDK

A lightweight, configurable telemetry tracking library for JavaScript/TypeScript applications with comprehensive error handling, event batching, and graceful degradation.

## 📦 Installation

```bash
npm install @jayeshsadhwani/telemetry-sdk
# or
yarn add @jayeshsadhwani/telemetry-sdk
# or
pnpm add @jayeshsadhwani/telemetry-sdk
```

## 🚀 Quick Start

### Next.js Applications

Create a client component for telemetry initialization:

```tsx
"use client";

import { useEffect } from "react";
import { initTelemetry } from "@jayeshsadhwani/telemetry-sdk";

function TelemetryProvider() {
  useEffect(() => {
    let telemetry = initTelemetry({
      hyperlookApiKey: "your-api-key", // Replace with your Hyperlook API key
    });

    return () => {
      telemetry.destroy();
    };
  }, []);
}

export default TelemetryProvider;
```

Then add it to your `layout.{tsx,jsx,ts,js}`:

```tsx
import TelemetryProvider from "./TelemetryProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TelemetryProvider />
        {children}
      </body>
    </html>
  );
}
```

That's it! The telemetry SDK will automatically start collecting data once the component mounts.

### React Applications

```tsx
// In your main App component or entry point
import { useEffect } from "react";
import { initTelemetry } from "@jayeshsadhwani/telemetry-sdk";

function App() {
  useEffect(() => {
    // Initialize telemetry once when the app starts
    const telemetry = initTelemetry({
      hyperlookApiKey: "your-api-key", // Replace with your Hyperlook API key
      enableClicks: true,
      enableLogs: true,
      enableNetwork: true,
      enablePerformance: true,
    });

    // Optional: Identify the user
    telemetry.identify("user-123", {
      name: "John Doe",
      email: "john@example.com",
    });

    // The SDK automatically sets up shutdown handlers, so no cleanup needed
  }, []);

  return <div>{/* Your app content */}</div>;
}

export default App;
```

### Basic Usage (Any JavaScript/TypeScript Application)

```typescript
import { initTelemetry } from "@jayeshsadhwani/telemetry-sdk";

// Initialize with default configuration
const telemetry = initTelemetry({
  hyperlookApiKey: "your-api-key", // Replace with your Hyperlook API key
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableCustomEvents: true, // Enable custom events
});

// Identify a user (optional)
telemetry.identify("user-123", {
  name: "John Doe",
  email: "john@example.com",
});

// The SDK automatically starts collecting telemetry data
```

## 🎯 Advanced Configuration

```typescript
import { initTelemetry } from "@jayeshsadhwani/telemetry-sdk";

const telemetry = initTelemetry({
  hyperlookApiKey: "your-api-key", // Replace with your Hyperlook API key

  // Event batching configuration
  batchSize: 50, // Number of events to batch before sending
  flushInterval: 30000, // Flush interval in milliseconds (30 seconds)

  // Retry configuration
  maxRetries: 3, // Maximum number of retry attempts
  retryDelay: 1000, // Delay between retries in milliseconds

  // Sampling configuration
  samplingRate: 0.1, // Only capture 10% of events (0.0 to 1.0)

  // Plugin configuration
  enablePageViews: true, // Track page view events (page_hit)
  enableClicks: true, // Track user clicks
  enableLogs: true, // Track console logs
  enableNetwork: true, // Track HTTP requests
  enablePerformance: true, // Track performance metrics
  enableCustomEvents: true, // Enable custom events plugin

  // Logging configuration
  logging: {
    level: "INFO", // Log level: ERROR, WARN, INFO, DEBUG, SILENT
    enableConsole: true, // Enable console logging
    enableTimestamp: true, // Include timestamps in logs
    prefix: "[MyApp]", // Custom log prefix
  },
});
```

## 🔧 API Reference

### `initTelemetry(config?: TelemetryConfig): TelemetryManager`

Initializes the telemetry SDK with the provided configuration. **Automatically sets up shutdown handlers** to ensure events are flushed when the application closes.

#### Automatic Shutdown Handling

The SDK automatically registers shutdown handlers when initialized:

**Browser Environment:**

- `beforeunload` event: Flushes events when the page is about to unload
- `pagehide` event: Flushes events when the page is hidden (mobile browsers, tab switching)
- `visibilitychange` event: Flushes events when the page becomes hidden (with 1-second delay to avoid unnecessary flushes)

**Node.js Environment:**

- `SIGTERM` signal: Graceful shutdown when the process receives termination signal
- `SIGINT` signal: Graceful shutdown when the process receives interrupt signal (Ctrl+C)
- `uncaughtException`: Shutdown on uncaught exceptions
- `unhandledRejection`: Shutdown on unhandled promise rejections
- `exit` event: Force cleanup when the process exits

This ensures that telemetry data is not lost even if developers forget to manually call `shutdown()`.

#### Configuration Options

| Option               | Type           | Default        | Description                              |
| -------------------- | -------------- | -------------- | ---------------------------------------- |
| `hyperlookApiKey`    | `string`       | Required       | Your Hyperlook API key                   |
| `batchSize`          | `number`       | `50`           | Number of events to batch before sending |
| `flushInterval`      | `number`       | `30000`        | Flush interval in milliseconds           |
| `maxRetries`         | `number`       | `3`            | Maximum number of retry attempts         |
| `retryDelay`         | `number`       | `1000`         | Delay between retries in milliseconds    |
| `samplingRate`       | `number`       | `1.0`          | Sampling rate (0.0 to 1.0)               |
| `enablePageViews`    | `boolean`      | `true`         | Enable page view tracking (page_hit)     |
| `enableClicks`       | `boolean`      | `true`         | Enable click event tracking              |
| `enableLogs`         | `boolean`      | `true`         | Enable console log tracking              |
| `enableNetwork`      | `boolean`      | `true`         | Enable network request tracking          |
| `enablePerformance`  | `boolean`      | `true`         | Enable performance metrics tracking      |
| `enableCustomEvents` | `boolean`      | `false`        | Enable custom events plugin              |
| `sessionId`          | `string`       | Auto-generated | Custom session ID for tracking           |
| `userId`             | `string`       | `undefined`    | Initial user ID for identification       |
| `logging`            | `LoggerConfig` | `{}`           | Logging configuration                    |

### TelemetryManager Methods

#### `capture(event: TelemetryEvent): void`

Captures a custom telemetry event.

```typescript
telemetry.capture({
  eventType: "custom",
  eventName: "user_action",
  payload: {
    action: "button_click",
    buttonId: "submit-form",
    userId: "12345",
  },
  timestamp: new Date().toISOString(),
});
```

#### `shutdown(): Promise<void>`

Gracefully shuts down the telemetry manager, flushing any remaining events.

```typescript
// Before your app closes
await telemetry.shutdown();
```

**Note:** The SDK automatically sets up shutdown handlers when initialized, so events will be flushed even if you don't manually call `shutdown()`. This includes:

- Browser: `beforeunload` and `pagehide` events
- Node.js: `SIGTERM`, `SIGINT`, `uncaughtException`, and `unhandledRejection` events

#### `destroy(): void`

Immediately destroys the telemetry manager without flushing events.

```typescript
// Emergency cleanup
telemetry.destroy();
```

#### `retryFailedEvents(): Promise<void>`

Retries sending failed events.

```typescript
// Retry failed events when network is restored
await telemetry.retryFailedEvents();
```

#### `identify(userId: string, traits?: Record<string, unknown>): void`

Identifies a user with the given user ID and optional traits. This creates an "identify" event and sets the user ID for all subsequent events.

```typescript
// Identify a user with traits
telemetry.identify("user-123", {
  name: "John Doe",
  email: "john@example.com",
  plan: "premium",
  signupDate: "2024-01-15",
});

// Identify without traits
telemetry.identify("user-456");
```

#### `getSessionId(): string`

Returns the current session ID.

```typescript
const sessionId = telemetry.getSessionId();
console.log("Current session:", sessionId);
```

#### `getUserId(): string | undefined`

Returns the current user ID if set.

```typescript
const userId = telemetry.getUserId();
console.log("Current user:", userId);
```

#### `getCustomEventsPlugin(): CustomEventsPlugin | undefined`

Returns the custom events plugin if enabled, allowing you to capture custom events.

```typescript
const customPlugin = telemetry.getCustomEventsPlugin();
if (customPlugin) {
  customPlugin.captureCustomEvent("ecommerce", "purchase", {
    productId: "prod_123",
    amount: 99.99,
  });
}
```

#### Monitoring Methods

```typescript
// Get counts of different event types
const failedCount = telemetry.getFailedEventsCount();
const queuedCount = telemetry.getQueuedEventsCount();
const bufferedCount = telemetry.getBufferedEventsCount();

console.log(
  `Failed: ${failedCount}, Queued: ${queuedCount}, Buffered: ${bufferedCount}`
);
```

## 🎯 Custom Events & User Identification

### User Identification

The SDK supports user identification through the `identify()` method, which creates an "identify" event and sets the user ID for all subsequent events.

```typescript
// Initialize with custom events enabled
const telemetry = initTelemetry({
  hyperlookApiKey: "your-api-key",
  enableCustomEvents: true,
  sessionId: "custom-session-123", // Optional: provide custom session ID
  userId: "user-456", // Optional: provide initial user ID
});

// Identify a user with traits
telemetry.identify("user-789", {
  name: "John Doe",
  email: "john@example.com",
  plan: "premium",
  signupDate: "2024-01-15",
});
```

### Custom Events

When `enableCustomEvents` is enabled, you can capture custom events using the CustomEventsPlugin:

```typescript
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

  // Capture a pre-built event object
  const customEvent = {
    eventType: "analytics",
    eventName: "page_view",
    payload: {
      page: "/dashboard",
      referrer: document.referrer,
    },
    timestamp: new Date().toISOString(),
  };
  customPlugin.captureEvent(customEvent);
}
```

### Session Tracking

All events automatically include session tracking. The session ID is either provided in the configuration or auto-generated:

```typescript
// Events automatically include session and user context
telemetry.capture({
  eventType: "interaction",
  eventName: "button_click",
  payload: {
    buttonId: "submit-form",
    page: "/contact",
  },
  timestamp: new Date().toISOString(),
});

// The above event will automatically include:
// - sessionId: "custom-session-123" (or auto-generated)
// - userId: "user-789" (if identified)
```

## 🚀 Features

- **Event Batching**: Efficiently batches events for optimal network performance
- **Error Boundaries**: Comprehensive error handling with graceful degradation
- **Plugin Architecture**: Modular design with built-in plugins for common use cases
- **Type Safety**: Full TypeScript support with strict type checking
- **Environment Detection**: Automatic detection of browser vs Node.js environments
- **Performance Monitoring**: Built-in performance metrics collection
- **Network Monitoring**: Automatic HTTP request tracking
- **Console Logging**: Intercepts and tracks console logs with XSS protection
- **User Interactions**: Captures click events and user interactions
- **User Identification**: Track user identity with traits and session management
- **Custom Events**: Capture user-defined events with flexible payloads
- **Session Tracking**: Automatic session ID generation and tracking
- **Input Validation**: Comprehensive validation and sanitization of all user data
- **Automatic Shutdown**: Ensures events are flushed when the application closes (browser unload, Node.js process termination)

## 🔄 TelemetryTracker Compatibility

The SDK is designed to be fully compatible with the TelemetryTracker format. All events are sent to Hyperlook in the exact same format and structure as your TelemetryTracker implementation:

### Event Format Compatibility

All events include the same properties as TelemetryTracker:

- `event_id`: Auto-generated unique event ID
- `user_id`: User identification (if provided)
- `session_id`: Session tracking
- `event_type`: Event category (page, network, error, etc.)
- `event_name`: Specific event name
- `properties`: Event-specific data
- `user_properties`: User-specific data
- `page_url`: Current page URL
- `page_title`: Page title
- `referrer`: Referrer URL
- `user_agent`: Browser user agent
- `timestamp`: ISO timestamp

### API Key Configuration

The SDK requires a Hyperlook API key to be provided:

- **Required**: Must provide `hyperlookApiKey` in configuration
- **Security**: No default API key is used for security reasons
- **Configuration**: Set via `hyperlookApiKey` parameter in `initTelemetry()`

### Event Type Mapping

| TelemetryTracker Event        | SDK Event                     | Properties                                                                                                                                 |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `PAGE_HIT`                    | `page_hit`                    | viewport, characterSet, language, cookieEnabled, onLine, platform, userAgent, referrer, url, title                                         |
| `XHR_COMPLETE`                | `xhr_complete`                | url, method, queryParams, responseStatus, responseStatusText, responseHeaders, responseBody, duration, startTime, endTime, isSupabaseQuery |
| `FETCH_COMPLETE`              | `fetch_complete`              | url, method, queryParams, responseStatus, responseStatusText, responseHeaders, responseBody, duration, startTime, endTime, isSupabaseQuery |
| `JAVASCRIPT_ERROR`            | `javascript_error`            | message, filename, lineno, colno, error, stack                                                                                             |
| `UNHANDLED_PROMISE_REJECTION` | `unhandled_promise_rejection` | reason, promise                                                                                                                            |

## 📊 Event Types

The SDK automatically captures various types of events:

### Automatic Events

- **Page View Events**: Automatic page_hit events when someone first visits a page or navigates to a new page (React/Next.js client-side routing)
- **Click Events**: User interactions with DOM elements
- **Network Events**: HTTP requests and responses (fetch, XHR)
- **Performance Events**: Page load metrics, Core Web Vitals, long tasks
- **Log Events**: Console logs (log, warn, error, info, debug)
- **Error Events**: JavaScript errors and exceptions

### Custom Events

Enables capturing custom events with user-defined types, names, and payloads. Must be enabled via `enableCustomEvents: true` in the configuration.

```typescript
const customPlugin = telemetry.getCustomEventsPlugin();
if (customPlugin) {
  customPlugin.captureCustomEvent("ecommerce", "purchase", {
    productId: "prod_123",
    amount: 99.99,
  });
}
```

## 🔌 Plugin System

The SDK uses a plugin architecture for extensibility. Built-in plugins include:

### PageViewPlugin

Automatically captures page_hit events when someone first visits a page and on client-side navigation in React/Next.js applications. Includes viewport information, browser details, and page metadata. Now supports:

- **Initial page loads**: Captures page view when the page first loads
- **React Router navigation**: Safely tracks URL and title changes without interfering with routing
- **Next.js client-side routing**: Automatically detects and tracks navigation using safe polling
- **Browser navigation**: Captures back/forward button usage
- **Duplicate prevention**: Avoids sending multiple events for the same URL/title combination
- **Navigation flag**: Includes `isNavigation` flag to distinguish initial loads from navigation

### ClickPlugin

Tracks user click events with element information.

### LogPlugin

Intercepts and tracks console.log, console.error, etc.

### NetworkPlugin

Monitors fetch and XMLHttpRequest calls.

### ErrorPlugin

Captures JavaScript errors and unhandled promise rejections.

### PerformancePlugin

Collects performance metrics including Web Vitals.

### CustomEventsPlugin

Enables capturing custom events with user-defined types, names, and payloads. Must be enabled via `enableCustomEvents: true` in the configuration.

```typescript
const customPlugin = telemetry.getCustomEventsPlugin();
if (customPlugin) {
  customPlugin.captureCustomEvent("ecommerce", "purchase", {
    productId: "prod_123",
    amount: 99.99,
  });
}
```

## 🛡️ Error Handling

The SDK includes comprehensive error handling:

### Graceful Degradation

If initialization fails, the SDK returns a no-op manager that won't crash your application.

### Plugin Error Isolation

Each plugin has its own error boundaries. If one plugin fails, others continue working.

### Event-Level Error Handling

Individual event failures don't affect the processing of other events.

### Automatic Retry

Failed network requests are automatically retried with exponential backoff.

## 🌍 Environment Support

The SDK automatically detects the environment and enables appropriate features:

- **Browser**: All plugins available
- **Node.js**: Only LogPlugin available (console tracking)
- **React Native**: Limited plugin support based on available APIs

## 📈 Performance Considerations

### Event Batching

Events are automatically batched to reduce network overhead.

### Sampling

Use sampling to reduce data volume in high-traffic applications.

### Memory Management

Failed events are automatically cleaned up to prevent memory leaks.

## 🔒 Privacy & Security

- No personally identifiable information is collected by default
- All data is sent to your specified endpoint
- No data is stored locally beyond the current session
- Failed events are automatically cleaned up

## 📄 License

ISC

## 📞 Support

For issues and questions, please open an issue on GitHub.
