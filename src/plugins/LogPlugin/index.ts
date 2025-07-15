import { BasePlugin } from "../BasePlugin";
import type { ConsoleMethod } from "./types";
import { setupConsoleInterceptors } from "./utils";

export class LogPlugin extends BasePlugin {
  private originals: Partial<Record<ConsoleMethod, typeof console.log>> = {};

  protected isSupported(): boolean {
    return typeof console !== "undefined";
  }

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("LogPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      setupConsoleInterceptors({
        originals: this.originals,
        safeCapture: this.safeCapture.bind(this),
      });

      this.logger.info("LogPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup LogPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  public teardown(): void {
    try {
      // Restore originals
      (Object.keys(this.originals) as ConsoleMethod[]).forEach(method => {
        const original = this.originals[method];
        if (original) {
          console[method] = original;
        }
      });
      this.logger.info("LogPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown LogPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
