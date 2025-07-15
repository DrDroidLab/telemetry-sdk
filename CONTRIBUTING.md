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

## 🧩 Creating a New Plugin

Plugins extend the SDK's functionality. To create a new plugin:

1. **Create a new file** in `src/plugins/`, e.g. `MyCustomPlugin.ts`.
2. **Extend the `BasePlugin` class** and implement the `setup()` method.
3. **Use `this.safeCapture()` to emit events.**
4. **Register your plugin** in your app or in a test file.

### Example: Scroll Tracking Plugin

```typescript
import { BasePlugin } from "../src/plugins/BasePlugin";
import type { TelemetryEvent } from "../src/types";

export class ScrollPlugin extends BasePlugin {
  private handler = () => {
    this.safeCapture({
      eventType: "interaction",
      eventName: "scroll",
      payload: {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
      },
      timestamp: new Date().toISOString(),
    } as TelemetryEvent);
  };

  protected setup(): void {
    window.addEventListener("scroll", this.handler);
    this.logger.info("ScrollPlugin setup complete");
  }

  teardown(): void {
    window.removeEventListener("scroll", this.handler);
    this.logger.info("ScrollPlugin teardown complete");
  }
}
```

**Register your plugin:**

```typescript
import { initTelemetry } from "telemetry-sdk";
import { ScrollPlugin } from "./src/plugins/ScrollPlugin";

const telemetry = initTelemetry({ endpoint: "https://your-api.com/telemetry" });
telemetry.register(new ScrollPlugin());
```

### Best Practices for Plugins

- Always use `this.safeCapture()` to emit events (handles errors gracefully)
- Clean up listeners in `teardown()`
- Use `isSupported()` for environment checks if your plugin is browser-specific
- Log setup/teardown for easier debugging
- Keep plugins focused on a single responsibility

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
