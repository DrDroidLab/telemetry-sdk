import type { TelemetryEvent, Logger } from "../types";
import { TelemetryState } from "./types";
import { sanitizeString, sanitizePayload } from "./utils";

export class EventProcessor {
  private eventQueue: TelemetryEvent[] = [];
  private buffer: TelemetryEvent[] = [];
  private isProcessingQueue = false;
  private logger: Logger;
  private state: TelemetryState;
  private samplingRate: number;
  private batchSize: number;
  private sessionId: string;
  private userId?: string;

  constructor(
    logger: Logger,
    state: TelemetryState,
    samplingRate: number,
    batchSize: number,
    sessionId: string,
    userId?: string
  ) {
    this.logger = logger;
    this.state = state;
    this.samplingRate = samplingRate;
    this.batchSize = batchSize;
    this.sessionId = sessionId;
    if (userId !== undefined) {
      this.userId = userId;
    }
  }

  validateEvent(event: TelemetryEvent): TelemetryEvent {
    if (!event.eventType || typeof event.eventType !== "string") {
      throw new Error("Event type is required and must be a string");
    }
    if (!event.eventName || typeof event.eventName !== "string") {
      throw new Error("Event name is required and must be a string");
    }
    if (!event.payload || typeof event.payload !== "object") {
      throw new Error("Event payload is required and must be an object");
    }
    if (!event.timestamp || typeof event.timestamp !== "string") {
      throw new Error("Event timestamp is required and must be a string");
    }
    if (
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/.test(
        event.timestamp
      )
    ) {
      throw new Error("Invalid timestamp format. Expected ISO 8601 format");
    }
    const sanitizedEvent: TelemetryEvent = {
      ...event,
      eventType: sanitizeString(event.eventType, "eventType"),
      eventName: sanitizeString(event.eventName, "eventName"),
      payload: sanitizePayload(event.payload),
    };
    return sanitizedEvent;
  }

  capture(event: TelemetryEvent): boolean {
    try {
      this.validateState();

      const validatedEvent = this.validateEvent(event);
      if (Math.random() > this.samplingRate) {
        this.logger.debug("Event dropped due to sampling", {
          eventType: validatedEvent.eventType,
          eventName: validatedEvent.eventName,
          samplingRate: this.samplingRate,
        });
        return false;
      }

      const enrichedEvent: TelemetryEvent = {
        ...validatedEvent,
        sessionId: this.sessionId,
        ...(this.userId && { userId: this.userId }),
      };

      this.eventQueue.push(enrichedEvent);
      this.logger.debug("Event queued", {
        eventType: validatedEvent.eventType,
        eventName: validatedEvent.eventName,
        queueSize: this.eventQueue.length,
        sessionId: this.sessionId,
        userId: this.userId,
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to capture event", {
        eventType: event.eventType,
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  processEventQueue(): void {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          this.buffer.push(event);
          this.logger.debug("Event processed and added to buffer", {
            eventType: event.eventType,
            eventName: event.eventName,
            bufferSize: this.buffer.length,
          });
        }
      }
    } catch (error) {
      this.logger.error("Error processing event queue", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  getBatchForExport(): TelemetryEvent[] {
    return this.buffer.splice(0);
  }

  returnBatchToBuffer(batch: TelemetryEvent[]): void {
    this.buffer.unshift(...batch);
  }

  isBufferFull(): boolean {
    return this.buffer.length >= this.batchSize;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  private validateState(): void {
    if (
      this.state === TelemetryState.SHUTDOWN ||
      this.state === TelemetryState.SHUTTING_DOWN
    ) {
      throw new Error(
        `TelemetryManager is in ${this.state} state and cannot process events`
      );
    }
  }

  setState(state: TelemetryState): void {
    this.state = state;
  }

  clear(): void {
    this.buffer = [];
    this.eventQueue = [];
  }
}
