# Contributing to Telemetry SDK

Thank you for your interest in contributing to the Telemetry SDK! 🎉

We welcome contributions of all kinds: bug fixes, new features, documentation, and especially new plugins.

## 🚀 Getting Started

1. **Fork the repository** and clone your fork locally:

   ```bash
   git clone https://github.com/your-username/telemetry-sdk.git
   cd telemetry-sdk
   ```

2. **Install dependencies** (using pnpm, npm, or yarn):

   ```bash
   pnpm install
   # or
   npm install
   # or
   yarn install
   ```

3. **Start development mode** (auto-rebuild on changes):

   ```bash
   pnpm run dev
   # or
   npm run dev
   # or
   yarn dev
   ```

4. **Run tests**:

   ```bash
   pnpm test
   # or
   npm test
   # or
   yarn test
   ```

5. **Build the SDK**:

   ```bash
   pnpm run build
   # or
   npm run build
   # or
   yarn build
   ```

## 🧩 Creating a New Plugin - Complete Guide

This guide walks you through adding a new plugin to the telemetry SDK step by step. We'll use the PageViewPlugin as an example.

### Step 1: Create the Plugin File

**File**: `src/plugins/YourPluginName.ts`
**Purpose**: Defines the main plugin logic and event capture functionality

```typescript
import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class YourPluginName extends BasePlugin {
  // Plugin-specific properties
  private hasInitialized = false;

  // Check if the plugin is supported in the current environment
  protected isSupported(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  // Main event capture logic
  private captureEvent = () => {
    try {
      if (this.hasInitialized) {
        return;
      }

      this.hasInitialized = true;

      const evt: TelemetryEvent = {
        eventType: "your_event_type",
        eventName: "your_event_name",
        payload: {
          // Your event data here
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Your event captured", {
        // Log relevant data
      });

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to capture your event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Plugin initialization - called when the plugin is enabled
  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("YourPluginName not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      // Set up event listeners, timers, observers, etc.
      // Example: window.addEventListener("your_event", this.captureEvent);

      this.logger.info("YourPluginName setup complete");
    } catch (error) {
      this.logger.error("Failed to setup YourPluginName", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  // Plugin cleanup - called when the plugin is disabled or SDK shuts down
  teardown(): void {
    try {
      // Clean up event listeners, timers, observers, etc.
      // Example: window.removeEventListener("your_event", this.captureEvent);

      this.logger.info("YourPluginName teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown YourPluginName", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

### Step 2: Export the Plugin

**File**: `src/plugins/index.ts`
**Purpose**: Makes the plugin available for import by other parts of the SDK

```typescript
export { BasePlugin } from "./BasePlugin";
export { ClickPlugin } from "./ClickPlugin";
export { CustomEventsPlugin } from "./CustomEventsPlugin";
export { ErrorPlugin } from "./ErrorPlugin";
export { LogPlugin } from "./LogPlugin";
export { NetworkPlugin } from "./NetworkPlugin";
export { PerformancePlugin } from "./PerformancePlugin";
export { PageViewPlugin } from "./PageViewPlugin";
export { YourPluginName } from "./YourPluginName"; // Add this line
```

### Step 3: Export from Main SDK

**File**: `src/index.ts`
**Purpose**: Makes the plugin available to SDK users

```typescript
// Add import
import { YourPluginName } from "./plugins/YourPluginName";

// Add to exports
export {
  TelemetryManager,
  BasePlugin,
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
  CustomEventsPlugin,
  PageViewPlugin,
  YourPluginName, // Add this line
  HTTPExporter,
  getLogger,
  setLogger,
  createLogger,
};
```

### Step 4: Add Configuration Option

**File**: `src/types/TelemetryConfig.ts`
**Purpose**: Defines the configuration option to enable/disable your plugin

```typescript
export type TelemetryConfig = {
  endpoint?: string;
  hyperlookApiKey?: string;
  exporters?: ExporterType[];
  enablePageViews?: boolean;
  enableClicks?: boolean;
  enableLogs?: boolean;
  enableNetwork?: boolean;
  enablePerformance?: boolean;
  enableYourPlugin?: boolean; // Add this line
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  samplingRate?: number;
  logging?: LoggerConfig;
  sessionId?: string;
  userId?: string;
  enableCustomEvents?: boolean;
};
```

### Step 5: Set Default Configuration

**File**: `src/utils/initialTelemetryConfig.ts`
**Purpose**: Sets the default value for your plugin's enable option

```typescript
export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.your-domain.com/telemetry",
  hyperlookApiKey: "your-hyperlook-api-key-here",
  exporters: [ExporterType.HYPERLOOK],
  enablePageViews: true,
  batchSize: 5,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableYourPlugin: false, // Add this line (usually false by default)
  enableCustomEvents: false,
  flushInterval: 10000,
  maxRetries: 3,
  retryDelay: 1000,
  samplingRate: 1.0,
};
```

### Step 6: Register Plugin in PluginManager

**File**: `src/TelemetryManager/PluginManager.ts`
**Purpose**: Automatically initializes your plugin when enabled in configuration

```typescript
// Add import
import {
  ClickPlugin,
  LogPlugin,
  NetworkPlugin,
  PerformancePlugin,
  CustomEventsPlugin,
  PageViewPlugin,
  YourPluginName, // Add this line
} from "../plugins";

// Add to plugin configurations array
const pluginConfigs = [
  {
    enabled: config.enablePageViews ?? true,
    plugin: PageViewPlugin,
    name: "PageViewPlugin",
  },
  {
    enabled: config.enableClicks,
    plugin: ClickPlugin,
    name: "ClickPlugin",
  },
  {
    enabled: config.enableLogs,
    plugin: LogPlugin,
    name: "LogPlugin",
  },
  {
    enabled: config.enableNetwork,
    plugin: NetworkPlugin,
    name: "NetworkPlugin",
  },
  {
    enabled: config.enablePerformance,
    plugin: PerformancePlugin,
    name: "PerformancePlugin",
  },
  {
    enabled: config.enableYourPlugin, // Add this block
    plugin: YourPluginName,
    name: "YourPluginName",
  },
  {
    enabled: config.enableCustomEvents,
    plugin: CustomEventsPlugin,
    name: "CustomEventsPlugin",
    isCustomEvents: true,
  },
];
```

### Step 7: Update Initialization Logging

**File**: `src/TelemetryManager/index.ts`
**Purpose**: Logs whether your plugin is enabled during SDK initialization

```typescript
this.logger.info("TelemetryManager initialized", {
  endpoint: HYPERLOOK_URL,
  batchSize: config.batchSize ?? 50,
  flushInterval: this.flushInterval,
  maxRetries: config.maxRetries ?? 3,
  samplingRate: config.samplingRate ?? 1.0,
  enablePageViews: config.enablePageViews,
  enableClicks: config.enableClicks,
  enableLogs: config.enableLogs,
  enableNetwork: config.enableNetwork,
  enablePerformance: config.enablePerformance,
  enableYourPlugin: config.enableYourPlugin, // Add this line
  enableCustomEvents: config.enableCustomEvents,
  exporters: exportersToEnable,
});
```

### Step 8: Create an Example

**File**: `examples/your-plugin-example.ts`
**Purpose**: Shows users how to use your plugin

```typescript
import { initTelemetry } from "../src/index";

// Example: Your Plugin Usage
const telemetry = initTelemetry({
  hyperlookApiKey: "sk_your-api-key",

  // Enable your plugin
  enableYourPlugin: true,

  // Other configuration...
});

console.log("Your plugin initialized!");
```

### Step 9: Update Documentation

**File**: `README.md`
**Purpose**: Documents your plugin for users

Add to the configuration table:

```markdown
| `enableYourPlugin` | `boolean` | `false` | Enable your plugin description |
```

Add to the plugin system section:

```markdown
### YourPluginName

Brief description of what your plugin does and what events it captures.
```

### Step 10: Test Your Plugin

**Commands**: Build and test the SDK
**Purpose**: Ensures your plugin doesn't break anything

```bash
# Build the SDK
pnpm run build

# Run tests (if any)
pnpm test

# Test your plugin manually
node examples/your-plugin-example.ts
```

## 🔧 Plugin Best Practices

### Event Capture

- **Always use `this.safeCapture()`** - Handles errors gracefully and prevents crashes
- **Include meaningful payload data** - Make events useful for analytics
- **Use consistent event naming** - Follow the pattern: `event_type` and `event_name`

### Error Handling

- **Wrap event capture in try-catch** - Prevent plugin failures from affecting the SDK
- **Log errors appropriately** - Use `this.logger.error()` for debugging
- **Graceful degradation** - Disable plugin if setup fails

### Performance

- **Clean up resources** - Remove event listeners in `teardown()`
- **Avoid memory leaks** - Don't store references to DOM elements
- **Use efficient event handling** - Debounce or throttle if needed

### Environment Support

- **Check for browser APIs** - Use `isSupported()` for environment-specific features
- **Handle SSR gracefully** - Check for `window` and `document` availability
- **Provide fallbacks** - Work in different environments when possible

### Logging

- **Log setup/teardown** - Helps with debugging
- **Use appropriate log levels** - `debug` for details, `info` for status, `error` for issues
- **Include relevant context** - Log useful data for troubleshooting

## 📝 Example: Complete Plugin Implementation

Here's a complete example of a scroll tracking plugin:

```typescript
// src/plugins/ScrollPlugin.ts
import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class ScrollPlugin extends BasePlugin {
  private scrollHandler: (() => void) | null = null;
  private scrollTimeout: NodeJS.Timeout | null = null;

  protected isSupported(): boolean {
    return typeof window !== "undefined";
  }

  private captureScroll = () => {
    try {
      // Debounce scroll events
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }

      this.scrollTimeout = setTimeout(() => {
        const evt: TelemetryEvent = {
          eventType: "interaction",
          eventName: "scroll",
          payload: {
            scrollY: window.scrollY,
            scrollX: window.scrollX,
            viewportHeight: window.innerHeight,
            documentHeight: document.documentElement.scrollHeight,
            scrollPercentage:
              (window.scrollY /
                (document.documentElement.scrollHeight - window.innerHeight)) *
              100,
          },
          timestamp: new Date().toISOString(),
        };

        this.logger.debug("Scroll event captured", {
          scrollY: window.scrollY,
          scrollPercentage: evt.payload.scrollPercentage,
        });

        this.safeCapture(evt);
      }, 100); // Debounce for 100ms
    } catch (error) {
      this.logger.error("Failed to capture scroll event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("ScrollPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      this.scrollHandler = this.captureScroll.bind(this);
      window.addEventListener("scroll", this.scrollHandler, { passive: true });

      this.logger.info("ScrollPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup ScrollPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      if (this.scrollHandler) {
        window.removeEventListener("scroll", this.scrollHandler);
        this.scrollHandler = null;
      }

      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = null;
      }

      this.logger.info("ScrollPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown ScrollPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

## 📝 Coding Standards

- Use TypeScript and follow the existing code style
- Run `pnpm run build` and `pnpm test` before submitting a PR
- Write clear, descriptive commit messages
- Add or update documentation as needed
- Keep PRs focused and small when possible

## 🔄 Pull Request Process

1. Fork the repo and create your feature branch (`git checkout -b feature/my-plugin`)
2. Commit your changes (`git commit -am 'Add my plugin'`)
3. Push to your fork (`git push origin feature/my-plugin`)
4. Open a pull request on GitHub
5. Describe your changes and reference any related issues
6. A maintainer will review your PR and may request changes

## 💬 Questions & Help

- Open an [issue](https://github.com/your-org/telemetry-sdk/issues) for bugs, feature requests, or questions
- For plugin ideas or architecture questions, open a discussion or ask in your PR

## 🙏 Thanks for contributing

Your work helps make Telemetry SDK better for everyone. We appreciate your time and effort!
