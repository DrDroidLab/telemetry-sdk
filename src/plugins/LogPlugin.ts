import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";
import { TELEMETRY_SDK_PREFIX } from "../constants";

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

export class LogPlugin extends BasePlugin {
  private originals: Partial<Record<ConsoleMethod, typeof console.log>> = {};

  /**
   * Sanitize console arguments to prevent XSS
   */
  private sanitizeConsoleArgs(args: unknown[]): string[] {
    return args.map(arg => {
      try {
        if (typeof arg === "string") {
          // Basic XSS prevention for strings
          return arg
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;")
            .replace(/\//g, "&#x2F;");
        }
        if (typeof arg === "object" && arg !== null) {
          // For objects, try to safely stringify
          const sanitized = JSON.stringify(arg, (_key, value: string) => {
            if (typeof value === "string") {
              return value
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#x27;")
                .replace(/\//g, "&#x2F;");
            }
            return value;
          });
          return typeof sanitized === "string" ? sanitized : "[Object]";
        }
        return String(arg);
      } catch {
        // If stringification fails, return a safe fallback
        return "[Object]";
      }
    });
  }

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

          console[method] = (...args: unknown[]) => {
            // 1. forward to the real console
            const original = this.originals[method];
            if (original) {
              original(...args);
            }

            // 2. check if this is our own SDK log to prevent infinite recursion
            const sanitizedArgs = this.sanitizeConsoleArgs(args);
            const message = sanitizedArgs.join(" ");

            if (!message.includes(TELEMETRY_SDK_PREFIX)) {
              // 3. emit telemetry event with sanitized data
              const evt: TelemetryEvent = {
                eventType: "log",
                eventName: `console.${method}`,
                payload: {
                  method,
                  args: sanitizedArgs,
                  originalArgsCount: args.length,
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
      const original = this.originals[method];
      if (original) {
        console[method] = original;
      }
    });
    this.logger.info("LogPlugin teardown complete");
  }
}
