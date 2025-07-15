import { BasePlugin } from "./BasePlugin";
import { getLogger } from "../logger";
import type { TelemetryEvent } from "../types";
import { TELEMETRY_SDK_PREFIX } from "../constants";

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

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
      (["log", "info", "warn", "error", "debug"] as ConsoleMethod[]).forEach(
        method => {
          this.originals[method] = console[method].bind(console);

          console[method] = (...args: any[]) => {
            // 1. forward to the real console
            this.originals[method]!(...args);

            // 2. check if this is our own SDK log to prevent infinite recursion
            const message = args
              .map(arg =>
                typeof arg === "object" ? JSON.stringify(arg) : String(arg)
              )
              .join(" ");

            if (!message.includes(TELEMETRY_SDK_PREFIX)) {
              // 3. emit telemetry event
              const evt: TelemetryEvent = {
                eventType: "log",
                eventName: `console.${method}`,
                payload: {
                  method,
                  args: args.map(arg => {
                    try {
                      return JSON.stringify(arg);
                    } catch {
                      return String(arg);
                    }
                  }),
                },
                timestamp: new Date().toISOString(),
              };
              this.safeCapture(evt);
            }
          };
        }
      );

      this.logger.info("LogPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup LogPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  public teardown(): void {
    // Restore originals
    (Object.keys(this.originals) as ConsoleMethod[]).forEach(method => {
      if (this.originals[method]) {
        console[method] = this.originals[method]!;
      }
    });
    this.logger.info("LogPlugin teardown complete");
  }
}
