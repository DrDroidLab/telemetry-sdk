# Telemetry SDK

A lightweight, configurable telemetry tracking library for JavaScript/TypeScript applications.

## Features

- **Event Tracking**: Capture user interactions and custom events
- **Plugin System**: Extensible plugin architecture for different event types
- **Batch Processing**: Efficient event batching and HTTP export
- **Comprehensive Logging**: Built-in Winston-based logging system with configurable levels and formatting
- **TypeScript Support**: Full TypeScript support with type safety

## Logging

The SDK includes a comprehensive logging system built on Winston that can be configured to match your application's needs.

### Log Levels

- `DEBUG`: Detailed debug information
- `INFO`: General information messages
- `WARN`: Warning messages
- `ERROR`: Error messages
- `SILENT`: Disable all logging

### Basic Usage

```typescript
import { initTelemetry, LogLevel } from 'telemetry-sdk';

const telemetry = initTelemetry({
  endpoint: 'https://api.example.com/telemetry',
  enableClicks: true,
  logging: {
    level: LogLevel.INFO,
    prefix: '[MyApp]',
    enableTimestamp: true
  }
});
```

### Advanced Logging Configuration

```typescript
const telemetry = initTelemetry({
  endpoint: 'https://api.example.com/telemetry',
  enableClicks: true,
  logging: {
    level: LogLevel.DEBUG,
    enableConsole: true,
    enableTimestamp: true,
    prefix: '[TelemetrySDK]',
    customFormat: (info) => {
      return `[${new Date().toISOString()}] [${info.level.toUpperCase()}] ${info.message} ${info.meta ? JSON.stringify(info.meta) : ''}`;
    }
  }
});
```

### Custom Logger

```typescript
import { createLogger, LogLevel } from 'telemetry-sdk';

const customLogger = createLogger({
  level: LogLevel.WARN,
  prefix: '[CustomLogger]',
  enableConsole: true
});
```

### Production Configuration

For production environments, you can disable logging entirely:

```typescript
const telemetry = initTelemetry({
  endpoint: 'https://api.example.com/telemetry',
  enableClicks: true,
  logging: {
    level: LogLevel.SILENT
  }
});
```

### Winston Integration

The SDK uses Winston for logging, which provides:
- Multiple transport support (console, file, HTTP, etc.)
- Structured logging with metadata
- Performance optimizations
- Extensive formatting options
- Production-ready features
