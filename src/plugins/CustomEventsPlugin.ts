import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";
import { sanitizeString, sanitizePayload } from "../TelemetryManager/utils";

export class CustomEventsPlugin extends BasePlugin {
  private readonly MAX_EVENT_TYPE_LENGTH = 50;
  private readonly MAX_EVENT_NAME_LENGTH = 100;
  private readonly MAX_PAYLOAD_SIZE = 10000; // 10KB limit
  private readonly RESERVED_EVENT_TYPES = new Set([
    "system",
    "internal",
    "debug",
    "telemetry",
    "sdk",
  ]);

  protected isSupported(): boolean {
    return true; // Custom events are always supported
  }

  private validateEventType(eventType: string): void {
    if (!eventType || typeof eventType !== "string") {
      throw new Error("Event type is required and must be a string");
    }

    if (eventType.length > this.MAX_EVENT_TYPE_LENGTH) {
      throw new Error(
        `Event type too long (max ${this.MAX_EVENT_TYPE_LENGTH} characters)`
      );
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(eventType)) {
      throw new Error(
        "Event type must start with a letter and contain only letters, numbers, and underscores"
      );
    }

    if (this.RESERVED_EVENT_TYPES.has(eventType.toLowerCase())) {
      throw new Error(
        `Event type '${eventType}' is reserved and cannot be used`
      );
    }
  }

  private validateEventName(eventName: string): void {
    if (!eventName || typeof eventName !== "string") {
      throw new Error("Event name is required and must be a string");
    }

    if (eventName.length > this.MAX_EVENT_NAME_LENGTH) {
      throw new Error(
        `Event name too long (max ${this.MAX_EVENT_NAME_LENGTH} characters)`
      );
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(eventName)) {
      throw new Error(
        "Event name must start with a letter and contain only letters, numbers, and underscores"
      );
    }
  }

  private validatePayload(payload: unknown): void {
    if (payload === null || payload === undefined) {
      throw new Error("Payload cannot be null or undefined");
    }

    if (typeof payload !== "object") {
      throw new Error("Payload must be an object");
    }

    if (Array.isArray(payload)) {
      throw new Error("Payload cannot be an array");
    }

    // Check payload size
    const payloadString = JSON.stringify(payload);
    if (payloadString.length > this.MAX_PAYLOAD_SIZE) {
      throw new Error(`Payload too large (max ${this.MAX_PAYLOAD_SIZE} bytes)`);
    }
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
      // Validate inputs
      this.validateEventType(eventType);
      this.validateEventName(eventName);
      this.validatePayload(payload);

      const userId = this.manager.getUserId();
      const sessionId = this.manager.getSessionId();

      // Sanitize inputs
      const sanitizedEventType = sanitizeString(eventType, "eventType");
      const sanitizedEventName = sanitizeString(eventName, "eventName");
      const sanitizedPayload = sanitizePayload(
        payload as Record<string, unknown>
      );

      const event: TelemetryEvent<T> = {
        eventType: sanitizedEventType,
        eventName: sanitizedEventName,
        payload: sanitizedPayload as T,
        timestamp: new Date().toISOString(),
        ...(sessionId && { sessionId }),
        ...(userId && { userId }),
      };

      this.logger.debug("Custom event captured", {
        eventType: sanitizedEventType,
        eventName: sanitizedEventName,
        payloadKeys: Object.keys(sanitizedPayload),
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
      // Validate the event object
      if (!event || typeof event !== "object") {
        throw new Error("Event must be a valid TelemetryEvent object");
      }

      this.validateEventType(event.eventType);
      this.validateEventName(event.eventName);
      this.validatePayload(event.payload);

      // Validate timestamp
      if (!event.timestamp || typeof event.timestamp !== "string") {
        throw new Error("Event timestamp is required and must be a string");
      }

      // Validate timestamp format
      if (
        !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/.test(
          event.timestamp
        )
      ) {
        throw new Error("Invalid timestamp format. Expected ISO 8601 format");
      }

      this.logger.debug("Custom event captured", {
        eventType: event.eventType,
        eventName: event.eventName,
        payloadKeys: Object.keys(event.payload as Record<string, unknown>),
      });

      this.safeCapture(event as TelemetryEvent);
    } catch (error) {
      this.logger.error("Failed to capture custom event", {
        eventType: event?.eventType,
        eventName: event?.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  protected setup(): void {
    // No setup required for custom events plugin
    this.logger.info("CustomEventsPlugin setup complete");
  }
}
