# Telemetry SDK

A lightweight, configurable telemetry tracking library for JavaScript/TypeScript applications with comprehensive error handling, event batching, and graceful degradation.

## 📦 Installation

```bash
npm install @hyperlook/telemetry-sdk
```

## 🚀 Quick Start - Next.js

**Copy and paste these exact files:**

### 1. Create `components/TelemetryProvider.tsx`

```tsx
"use client";

import { useEffect } from "react";
import { initTelemetry } from "@hyperlook/telemetry-sdk";

export default function TelemetryProvider() {
  useEffect(() => {
    const telemetry = initTelemetry({
      hyperlookApiKey: "your-api-key", // Replace with your actual API key
    });

    return () => {
      telemetry.destroy();
    };
  }, []);

  return null;
}
```

### 2. Update `app/layout.tsx`

```tsx
import TelemetryProvider from "@/components/TelemetryProvider";

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

**That's it!** Your app will now automatically track:

- Page views
- User clicks
- Console logs
- Network requests
- Performance metrics

### Optional: Add User Identification

In any component where you have user data:

```tsx
"use client";

import { useEffect } from "react";
import { initTelemetry } from "@hyperlook/telemetry-sdk";

export default function UserProfile({ user }) {
  useEffect(() => {
    const telemetry = initTelemetry({
      hyperlookApiKey: "your-api-key",
    });

    if (user) {
      telemetry.identify(user.id, {
        name: user.name,
        email: user.email,
      });
    }

    return () => {
      telemetry.destroy();
    };
  }, [user]);

  return <div>{/* Your component content */}</div>;
}
```

## 🚀 Quick Start - React (Non-Next.js)

```tsx
import { useEffect } from "react";
import { initTelemetry } from "@hyperlook/telemetry-sdk";

function App() {
  useEffect(() => {
    const telemetry = initTelemetry({
      hyperlookApiKey: "your-api-key", // Replace with your actual API key
    });

    // Optional: Identify the user
    telemetry.identify("user-123", {
      name: "John Doe",
      email: "john@example.com",
    });
  }, []);

  return <div>{/* Your app content */}</div>;
}

export default App;
```

## 🚀 Quick Start - Vanilla JavaScript/TypeScript

```typescript
import { initTelemetry } from "@hyperlook/telemetry-sdk";

const telemetry = initTelemetry({
  hyperlookApiKey: "your-api-key", // Replace with your actual API key
});

// Optional: Identify a user
telemetry.identify("user-123", {
  name: "John Doe",
  email: "john@example.com",
});
```

## 🎯 Advanced Configuration

```typescript
import { initTelemetry } from "@hyperlook/telemetry-sdk";

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

#### Configuration Options

| Option                | Type           | Default        | Description                              |
| --------------------- | -------------- | -------------- | ---------------------------------------- |
| `hyperlookApiKey`     | `string`       | Required       | Your Hyperlook API key                   |
| `batchSize`           | `number`       | `50`           | Number of events to batch before sending |
| `flushInterval`       | `number`       | `30000`        | Flush interval in milliseconds           |
| `maxRetries`          | `number`       | `3`            | Maximum number of retry attempts         |
| `retryDelay`          | `number`       | `1000`         | Delay between retries in milliseconds    |
| `samplingRate`        | `number`       | `1.0`          | Sampling rate (0.0 to 1.0)               |
| `enablePageViews`     | `boolean`      | `true`         | Enable page view tracking (page_hit)     |
| `enableClicks`        | `boolean`      | `true`         | Enable click event tracking              |
| `enableLogs`          | `boolean`      | `true`         | Enable console log tracking              |
| `enableNetwork`       | `boolean`      | `true`         | Enable network request tracking          |
| `enablePerformance`   | `boolean`      | `true`         | Enable performance metrics tracking      |
| `enableCustomEvents`  | `boolean`      | `false`        | Enable custom events plugin              |
| `enableSessionReplay` | `boolean`      | `false`        | Enable session replay recording          |
| `sessionId`           | `string`       | Auto-generated | Custom session ID for tracking           |
| `userId`              | `string`       | `undefined`    | Initial user ID for identification       |
| `logging`             | `LoggerConfig` | `{}`           | Logging configuration                    |

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

#### `destroy(): void`

Immediately destroys the telemetry manager without flushing events.

```typescript
// Emergency cleanup
telemetry.destroy();
```

#### `identify(userId: string, traits?: Record<string, unknown>): void`

Identifies a user with the given user ID and optional traits.

```typescript
// Identify a user with traits
telemetry.identify("user-123", {
  name: "John Doe",
  email: "john@example.com",
  plan: "premium",
  signupDate: "2024-01-15",
});
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

## 🎯 Custom Events & User Identification

### Custom Events

When `enableCustomEvents` is enabled, you can capture custom events:

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
}
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
- **Session Replay**: Record and replay user sessions for debugging and analysis
- **Session Tracking**: Automatic session ID generation and tracking
- **Input Validation**: Comprehensive validation and sanitization of all user data
- **Automatic Shutdown**: Ensures events are flushed when the application closes

## 📊 Event Types

The SDK automatically captures various types of events:

- **Page View Events**: Automatic page_hit events when someone first visits a page or navigates to a new page
- **Click Events**: User interactions with DOM elements
- **Network Events**: HTTP requests and responses (fetch, XHR)
- **Performance Events**: Page load metrics, Core Web Vitals, long tasks
- **Log Events**: Console logs (log, warn, error, info, debug)
- **Error Events**: JavaScript errors and exceptions
- **Session Replay Events**: User session recordings for debugging and analysis

## 🔌 Plugin System

The SDK uses a plugin architecture for extensibility. Built-in plugins include:

- **PageViewPlugin**: Automatically captures page view events
- **ClickPlugin**: Tracks user click events with element information
- **LogPlugin**: Intercepts and tracks console logs
- **NetworkPlugin**: Monitors fetch and XMLHttpRequest calls
- **ErrorPlugin**: Captures JavaScript errors and unhandled promise rejections
- **PerformancePlugin**: Collects performance metrics including Web Vitals
- **CustomEventsPlugin**: Enables capturing custom events

## 🛡️ Error Handling

The SDK includes comprehensive error handling:

- **Graceful Degradation**: If initialization fails, the SDK returns a no-op manager
- **Plugin Error Isolation**: Each plugin has its own error boundaries
- **Event-Level Error Handling**: Individual event failures don't affect other events
- **Automatic Retry**: Failed network requests are automatically retried

## 🌍 Environment Support

The SDK automatically detects the environment and enables appropriate features:

- **Browser**: All plugins available
- **Node.js**: Only LogPlugin available (console tracking)
- **React Native**: Limited plugin support based on available APIs

## 📈 Performance Considerations

- **Event Batching**: Events are automatically batched to reduce network overhead
- **Sampling**: Use sampling to reduce data volume in high-traffic applications
- **Memory Management**: Failed events are automatically cleaned up to prevent memory leaks

## 🔒 Privacy & Security

- No personally identifiable information is collected by default
- All data is sent to your specified endpoint
- No data is stored locally beyond the current session
- Failed events are automatically cleaned up

## 📄 License

ISC

## 📞 Support

For issues and questions, please open an issue on GitHub.
