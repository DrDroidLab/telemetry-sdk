# Telemetry SDK

A lightweight, configurable telemetry tracking library for JavaScript/TypeScript applications with comprehensive error handling, event batching, and graceful degradation.

## 🚀 Features

- **Event Batching**: Efficiently batches events for optimal network performance
- **Error Boundaries**: Comprehensive error handling with graceful degradation
- **Plugin Architecture**: Modular design with built-in plugins for common use cases
- **Type Safety**: Full TypeScript support with strict type checking
- **Environment Detection**: Automatic detection of browser vs Node.js environments
- **Performance Monitoring**: Built-in performance metrics collection
- **Network Monitoring**: Automatic HTTP request tracking
- **Console Logging**: Intercepts and tracks console logs
- **User Interactions**: Captures click events and user interactions
- **User Identification**: Track user identity with traits and session management
- **Custom Events**: Capture user-defined events with flexible payloads
- **Session Tracking**: Automatic session ID generation and tracking

## 📦 Installation

```bash
npm install telemetry-sdk
# or
yarn add telemetry-sdk
# or
pnpm add telemetry-sdk
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { initTelemetry } from "telemetry-sdk";

// Initialize with default configuration
const telemetry = initTelemetry({
  endpoint: "https://your-api.com/telemetry",
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

### Advanced Configuration

```typescript
import { initTelemetry } from "telemetry-sdk";

const telemetry = initTelemetry({
  endpoint: "https://your-api.com/telemetry",

  // Event batching configuration
  batchSize: 50, // Number of events to batch before sending
  flushInterval: 30000, // Flush interval in milliseconds (30 seconds)

  // Retry configuration
  maxRetries: 3, // Maximum number of retry attempts
  retryDelay: 1000, // Delay between retries in milliseconds

  // Sampling configuration
  samplingRate: 0.1, // Only capture 10% of events (0.0 to 1.0)

  // Plugin configuration
  enableClicks: true, // Track user clicks
  enableLogs: true, // Track console logs
  enableNetwork: true, // Track HTTP requests
  enablePerformance: true, // Track performance metrics

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

Initializes the telemetry SDK with the provided configuration.

#### Configuration Options

| Option               | Type           | Default                      | Description                                |
| -------------------- | -------------- | ---------------------------- | ------------------------------------------ |
| `endpoint`           | `string`       | `"https://httpbin.org/post"` | The endpoint URL to send telemetry data to |
| `batchSize`          | `number`       | `50`                         | Number of events to batch before sending   |
| `flushInterval`      | `number`       | `30000`                      | Flush interval in milliseconds             |
| `maxRetries`         | `number`       | `3`                          | Maximum number of retry attempts           |
| `retryDelay`         | `number`       | `1000`                       | Delay between retries in milliseconds      |
| `samplingRate`       | `number`       | `1.0`                        | Sampling rate (0.0 to 1.0)                 |
| `enableClicks`       | `boolean`      | `true`                       | Enable click event tracking                |
| `enableLogs`         | `boolean`      | `true`                       | Enable console log tracking                |
| `enableNetwork`      | `boolean`      | `true`                       | Enable network request tracking            |
| `enablePerformance`  | `boolean`      | `true`                       | Enable performance metrics tracking        |
| `enableCustomEvents` | `boolean`      | `false`                      | Enable custom events plugin                |
| `sessionId`          | `string`       | Auto-generated               | Custom session ID for tracking             |
| `userId`             | `string`       | `undefined`                  | Initial user ID for identification         |
| `logging`            | `LoggerConfig` | `{}`                         | Logging configuration                      |

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
  endpoint: "https://your-api.com/telemetry",
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

## 📊 Event Types

The SDK automatically captures several types of events:

### Click Events (`interaction/click`)

```typescript
{
  eventType: 'interaction',
  eventName: 'click',
  payload: {
    tag: 'BUTTON',
    id: 'submit-button',
    classes: 'btn btn-primary',
    text: 'Submit',
    x: 150,
    y: 200,
  },
  timestamp: '2024-01-01T12:00:00.000Z',
}
```

### Console Log Events (`log/console.*`)

```typescript
{
  eventType: 'log',
  eventName: 'console.error',
  payload: {
    method: 'error',
    args: ['["User not found"]'],
  },
  timestamp: '2024-01-01T12:00:00.000Z',
}
```

### Network Events (`network/fetch`, `network/xhr`)

```typescript
{
  eventType: 'network',
  eventName: 'fetch',
  payload: {
    url: 'https://api.example.com/users',
    method: 'GET',
    status: 200,
    statusText: 'OK',
    duration: 150.5,
    timestamp: '2024-01-01T12:00:00.000Z',
    type: 'fetch',
  },
  timestamp: '2024-01-01T12:00:00.000Z',
}
```

### Performance Events (`performance/page_load_metrics`)

```typescript
{
  eventType: 'performance',
  eventName: 'page_load_metrics',
  payload: {
    totalPageLoadTime: 2500,
    dnsTime: 50,
    tcpTime: 100,
    requestTime: 200,
    responseTime: 150,
    domParsingTime: 500,
    resourceCount: 25,
    ttfb: 300,
    fcp: 1200,
    lcp: 1800,
  },
  timestamp: '2024-01-01T12:00:00.000Z',
}
```

### Identify Events (`identify/user_identified`)

```typescript
{
  eventType: 'identify',
  eventName: 'user_identified',
  payload: {
    userId: 'user-123',
    traits: {
      name: 'John Doe',
      email: 'john@example.com',
      plan: 'premium',
    },
  },
  timestamp: '2024-01-01T12:00:00.000Z',
  sessionId: 'session_1234567890_abc123def',
  userId: 'user-123',
}
```

### Custom Events (User-defined)

```typescript
{
  eventType: 'ecommerce', // User-defined
  eventName: 'product_viewed', // User-defined
  payload: {
    productId: 'prod_123',
    productName: 'Wireless Headphones',
    category: 'Electronics',
    price: 99.99,
    currency: 'USD',
  },
  timestamp: '2024-01-01T12:00:00.000Z',
  sessionId: 'session_1234567890_abc123def',
  userId: 'user-123',
}
```

## 🔌 Plugin System

The SDK uses a plugin architecture for extensibility. Built-in plugins include:

### ClickPlugin

Tracks user click events with element information.

### LogPlugin

Intercepts and tracks console.log, console.error, etc.

### NetworkPlugin

Monitors fetch and XMLHttpRequest calls.

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

### Creating Custom Plugins

```typescript
import { BasePlugin } from "telemetry-sdk";

class CustomPlugin extends BasePlugin {
  protected setup(): void {
    // Your setup logic here
    window.addEventListener("scroll", this.handleScroll.bind(this));
  }

  private handleScroll(event: Event): void {
    this.safeCapture({
      eventType: "interaction",
      eventName: "scroll",
      payload: {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
      },
      timestamp: new Date().toISOString(),
    });
  }

  teardown(): void {
    // Cleanup logic
    window.removeEventListener("scroll", this.handleScroll.bind(this));
  }
}

// Register your custom plugin
telemetry.register(new CustomPlugin());
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

## 🧪 Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## 📄 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on GitHub.
