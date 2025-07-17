# Plugin Development Quick Reference

This is a quick reference guide for adding new plugins to the telemetry SDK. For detailed explanations, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📋 Required Steps Checklist

### ✅ Step 1: Create Plugin File

**File**: `src/plugins/YourPluginName.ts`
**Purpose**: Main plugin logic and event capture

```typescript
import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class YourPluginName extends BasePlugin {
  protected isSupported(): boolean {
    return typeof window !== "undefined";
  }
  protected setup(): void {
    /* Initialize your plugin */
  }
  teardown(): void {
    /* Clean up resources */
  }
}
```

### ✅ Step 2: Export Plugin

**File**: `src/plugins/index.ts`
**Purpose**: Make plugin available for import

```typescript
export { YourPluginName } from "./YourPluginName"; // Add this line
```

### ✅ Step 3: Export from Main SDK

**File**: `src/index.ts`
**Purpose**: Make plugin available to users

```typescript
import { YourPluginName } from "./plugins/YourPluginName";
export { YourPluginName }; // Add to exports
```

### ✅ Step 4: Add Configuration Option

**File**: `src/types/TelemetryConfig.ts`
**Purpose**: Define enable/disable option

```typescript
export type TelemetryConfig = {
  enableYourPlugin?: boolean; // Add this line
  // ... other options
};
```

### ✅ Step 5: Set Default Configuration

**File**: `src/utils/initialTelemetryConfig.ts`
**Purpose**: Set default value

```typescript
export const initialTelemetryConfig: TelemetryConfig = {
  enableYourPlugin: false, // Add this line (usually false by default)
  // ... other defaults
};
```

### ✅ Step 6: Register in PluginManager

**File**: `src/TelemetryManager/PluginManager.ts`
**Purpose**: Auto-initialize when enabled

```typescript
import { YourPluginName } from "../plugins"; // Add import
const pluginConfigs = [
  {
    enabled: config.enableYourPlugin, // Add this block
    plugin: YourPluginName,
    name: "YourPluginName",
  },
  // ... other plugins
];
```

### ✅ Step 7: Update Initialization Logging

**File**: `src/TelemetryManager/index.ts`
**Purpose**: Log plugin status

```typescript
this.logger.info("TelemetryManager initialized", {
  enableYourPlugin: config.enableYourPlugin, // Add this line
  // ... other config
});
```

### ✅ Step 8: Create Example

**File**: `examples/your-plugin-example.ts`
**Purpose**: Show usage to users

```typescript
import { initTelemetry } from "../src/index";
const telemetry = initTelemetry({
  enableYourPlugin: true, // Enable your plugin
});
```

### ✅ Step 9: Update Documentation

**File**: `README.md`
**Purpose**: Document for users

- Add to configuration table
- Add to plugin system section

### ✅ Step 10: Test

**Commands**: Build and verify

```bash
pnpm run build
pnpm test
node examples/your-plugin-example.ts
```

## 🔧 Essential Plugin Methods

### Required Methods

```typescript
protected isSupported(): boolean {
  // Check if plugin works in current environment
  return typeof window !== "undefined";
}

protected setup(): void {
  // Initialize plugin (event listeners, timers, etc.)
  // Called when plugin is enabled
}

teardown(): void {
  // Clean up resources (remove listeners, clear timers)
  // Called when plugin is disabled or SDK shuts down
}
```

### Event Capture

```typescript
private captureEvent = () => {
  try {
    const evt: TelemetryEvent = {
      eventType: "your_type",
      eventName: "your_name",
      payload: { /* your data */ },
      timestamp: new Date().toISOString(),
    };
    this.safeCapture(evt); // Always use safeCapture!
  } catch (error) {
    this.logger.error("Failed to capture event", { error });
  }
};
```

## 🚨 Best Practices

### ✅ Do This

- Use `this.safeCapture()` for event capture
- Clean up resources in `teardown()`
- Check environment in `isSupported()`
- Log setup/teardown for debugging
- Wrap event capture in try-catch
- Use meaningful event names and payloads

### ❌ Don't Do This

- Don't use `this.capture()` directly (use `safeCapture`)
- Don't forget to clean up event listeners
- Don't assume browser APIs are available
- Don't let plugin errors crash the SDK
- Don't store DOM element references
- Don't forget to handle SSR environments

## 📝 Example: Complete Plugin

```typescript
// src/plugins/ExamplePlugin.ts
import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class ExamplePlugin extends BasePlugin {
  private handler: (() => void) | null = null;

  protected isSupported(): boolean {
    return typeof window !== "undefined";
  }

  private captureEvent = () => {
    try {
      const evt: TelemetryEvent = {
        eventType: "example",
        eventName: "event_captured",
        payload: {
          timestamp: new Date().toISOString(),
          data: "example data",
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Example event captured");
      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to capture example event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("ExamplePlugin not supported");
      this.isEnabled = false;
      return;
    }

    try {
      this.handler = this.captureEvent.bind(this);
      window.addEventListener("example", this.handler);
      this.logger.info("ExamplePlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup ExamplePlugin", { error });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      if (this.handler) {
        window.removeEventListener("example", this.handler);
        this.handler = null;
      }
      this.logger.info("ExamplePlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown ExamplePlugin", { error });
    }
  }
}
```

## 🎯 Quick Start Template

Copy this template and replace `YourPluginName` with your plugin name:

```typescript
import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class YourPluginName extends BasePlugin {
  protected isSupported(): boolean {
    return typeof window !== "undefined";
  }

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("YourPluginName not supported");
      this.isEnabled = false;
      return;
    }

    try {
      // Your initialization code here
      this.logger.info("YourPluginName setup complete");
    } catch (error) {
      this.logger.error("Failed to setup YourPluginName", { error });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      // Your cleanup code here
      this.logger.info("YourPluginName teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown YourPluginName", { error });
    }
  }
}
```

## 📚 Next Steps

1. Read the detailed guide in [CONTRIBUTING.md](./CONTRIBUTING.md)
2. Look at existing plugins for examples
3. Test your plugin thoroughly
4. Update documentation
5. Submit a pull request

Happy plugin development! 🚀
