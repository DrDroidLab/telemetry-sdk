import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class CustomEventsPlugin extends BasePlugin {
  protected isSupported(): boolean {
    return true; // Custom events are always supported
  }

  /**
   * Capture a custom event with the specified type, name, and payload
   */
  captureCustomEvent<T = Record<string, unknown>>(
    eventType: string,
    eventName: string,
    payload: T
  ): void {
    try {
      const userId = this.manager.getUserId();
      const sessionId = this.manager.getSessionId();

      const event: TelemetryEvent<T> = {
        eventType,
        eventName,
        payload,
        timestamp: new Date().toISOString(),
        ...(sessionId && { sessionId }),
        ...(userId && { userId }),
      };

      this.logger.debug("Custom event captured", {
        eventType,
        eventName,
        payloadKeys: Object.keys(payload as Record<string, unknown>),
      });

      this.safeCapture(event as TelemetryEvent);
    } catch (error) {
      this.logger.error("Failed to capture custom event", {
        eventType,
        eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Capture a custom event with a pre-built TelemetryEvent object
   */
  captureEvent<T = Record<string, unknown>>(event: TelemetryEvent<T>): void {
    try {
      this.logger.debug("Custom event captured", {
        eventType: event.eventType,
        eventName: event.eventName,
        payloadKeys: Object.keys(event.payload as Record<string, unknown>),
      });

      this.safeCapture(event as TelemetryEvent);
    } catch (error) {
      this.logger.error("Failed to capture custom event", {
        eventType: event.eventType,
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  protected setup(): void {
    // No setup required for custom events plugin
    this.logger.info("CustomEventsPlugin setup complete");
  }
}
