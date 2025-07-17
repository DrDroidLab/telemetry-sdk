import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class ErrorPlugin extends BasePlugin {
  private errorHandler = (event: ErrorEvent) => {
    try {
      const errorVal = event.error as unknown;
      let stackVal: string | undefined = undefined;
      if (
        errorVal &&
        typeof errorVal === "object" &&
        "stack" in errorVal &&
        typeof (errorVal as { stack?: unknown }).stack === "string"
      ) {
        stackVal = (errorVal as { stack: string }).stack;
      }
      const evt: TelemetryEvent = {
        eventType: "error",
        eventName: "javascript_error",
        payload: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error ? JSON.stringify(event.error) : undefined,
          stack: stackVal,
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("JavaScript error captured", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
      });

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to process JavaScript error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  private unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    try {
      const reasonStr = JSON.stringify(event.reason);
      const evt: TelemetryEvent = {
        eventType: "error",
        eventName: "unhandled_promise_rejection",
        payload: {
          reason: reasonStr,
          promise: event.promise,
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Unhandled promise rejection captured", {
        reason: JSON.stringify(event.reason),
      });

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to process unhandled promise rejection", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  protected isSupported(): boolean {
    return typeof window !== "undefined";
  }

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("ErrorPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      window.addEventListener("error", this.errorHandler);
      window.addEventListener(
        "unhandledrejection",
        this.unhandledRejectionHandler
      );
      this.logger.info("ErrorPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup ErrorPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      if (typeof window !== "undefined") {
        window.removeEventListener("error", this.errorHandler);
        window.removeEventListener(
          "unhandledrejection",
          this.unhandledRejectionHandler
        );
      }
      this.logger.info("ErrorPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown ErrorPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
