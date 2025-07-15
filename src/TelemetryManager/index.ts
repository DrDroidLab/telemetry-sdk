import { HTTPExporter } from "../exporters";
import { getLogger, setLogger, createLogger } from "../logger";
import { CustomEventsPlugin } from "../plugins";
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryExporter,
  TelemetryPlugin,
  Logger,
} from "../types";
import {
  sanitizeString,
  sanitizePayload,
  validateConfig,
  generateSessionId,
} from "./utils";

export class TelemetryManager {
  private buffer: TelemetryEvent[] = [];
  private plugins: TelemetryPlugin[] = [];
  private exporter: TelemetryExporter | null = null;
  private batchSize: number;
  private flushInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private samplingRate: number;
  private flushTimer: NodeJS.Timeout | undefined;
  private logger: Logger;
  private eventQueue: TelemetryEvent[] = [];
  private isProcessingQueue = false;
  private failedEvents: TelemetryEvent[] = [];
  private maxFailedEvents = 1000; // Prevent memory leaks from failed events
  private sessionId!: string;
  private userId?: string;
  private customEventsPlugin?: CustomEventsPlugin;
  isShutdown = false;
  private isFlushing = false;

  constructor(config: TelemetryConfig) {
    validateConfig(config);
    this.exporter = new HTTPExporter(config.endpoint);
    this.batchSize = config.batchSize ?? 50;
    this.flushInterval = config.flushInterval ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.samplingRate = config.samplingRate ?? 1.0;
    this.sessionId = config.sessionId ?? generateSessionId();
    if (config.userId) {
      this.userId = config.userId;
    }
    if (config.logging) {
      const customLogger = createLogger(config.logging);
      setLogger(customLogger);
    }
    this.logger = getLogger();
    if (config.enableCustomEvents) {
      this.customEventsPlugin = new CustomEventsPlugin();
      this.register(this.customEventsPlugin);
    }
    this.startFlushTimer();
    this.logger.info("TelemetryManager initialized", {
      endpoint: config.endpoint,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
      maxRetries: this.maxRetries,
      samplingRate: this.samplingRate,
      enableClicks: config.enableClicks,
      enablePerformance: config.enablePerformance,
    });
  }

  register(plugin: TelemetryPlugin) {
    try {
      this.plugins.push(plugin);
      plugin.initialize(this);
      this.logger.debug("Plugin registered", {
        pluginName: plugin.constructor.name,
        totalPlugins: this.plugins.length,
      });
    } catch (error) {
      this.logger.error("Failed to register plugin", {
        pluginName: plugin.constructor.name,
        error: error instanceof Error ? error.message : String(error),
      });
      this.plugins.pop();
    }
  }

  private validateEvent(event: TelemetryEvent): TelemetryEvent {
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

  capture(evt: TelemetryEvent) {
    try {
      if (this.isShutdown) {
        this.logger.warn(
          "Cannot capture event - TelemetryManager is shutdown",
          {
            eventType: evt.eventType,
            eventName: evt.eventName,
          }
        );
        return;
      }
      const validatedEvent = this.validateEvent(evt);
      if (Math.random() > this.samplingRate) {
        this.logger.debug("Event dropped due to sampling", {
          eventType: validatedEvent.eventType,
          eventName: validatedEvent.eventName,
          samplingRate: this.samplingRate,
        });
        return;
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
      if (!this.isProcessingQueue) {
        void this.processEventQueue();
      }
      if (this.buffer.length >= this.batchSize) {
        this.logger.info("Buffer full, triggering flush", {
          bufferSize: this.buffer.length,
          batchSize: this.batchSize,
        });
        void this.flush();
      }
    } catch (error) {
      this.logger.error("Failed to capture event", {
        eventType: evt.eventType,
        eventName: evt.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startFlushTimer(): void {
    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (this.buffer.length > 0) {
          this.logger.debug("Periodic flush triggered", {
            bufferSize: this.buffer.length,
            flushInterval: this.flushInterval,
          });
          void this.flush();
        }
      }, this.flushInterval);
    }
  }

  async flush() {
    if (!this.buffer.length) {
      this.logger.debug("No events to flush");
      return;
    }
    if (this.isFlushing) {
      this.logger.debug("Flush already in progress, skipping");
      return;
    }
    this.isFlushing = true;
    try {
      const batch = this.buffer.splice(0);
      this.logger.info("Flushing events", {
        eventCount: batch.length,
        events: batch.map(e => ({ type: e.eventType, name: e.eventName })),
      });
      let retries = 0;
      while (retries <= this.maxRetries) {
        try {
          await this.exporter?.export(batch);
          this.logger.info("Events exported successfully", {
            eventCount: batch.length,
            retries,
          });
          return;
        } catch (error) {
          retries++;
          this.logger.error("Failed to export events", {
            error: error instanceof Error ? error.message : String(error),
            eventCount: batch.length,
            retry: retries,
            maxRetries: this.maxRetries,
          });
          if (retries <= this.maxRetries) {
            await new Promise(resolve =>
              setTimeout(resolve, this.retryDelay * retries)
            );
          } else {
            this.buffer.unshift(...batch);
            this.logger.error(
              "Max retries exceeded, events returned to buffer",
              {
                eventCount: batch.length,
              }
            );
          }
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down TelemetryManager");
    this.isShutdown = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    for (const p of this.plugins) {
      try {
        p.teardown?.();
        this.logger.debug("Plugin teardown completed", {
          pluginName: p.constructor.name,
        });
      } catch (error) {
        this.logger.error("Plugin teardown failed", {
          pluginName: p.constructor.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await this.flush();
    this.plugins = [];
    this.buffer = [];
    this.exporter = null;
    this.logger.info("TelemetryManager shutdown complete");
  }

  destroy(): void {
    this.logger.warn("Force destroying TelemetryManager");
    this.isShutdown = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.buffer = [];
    this.plugins = [];
    this.exporter = null;
    this.logger.info("TelemetryManager destroyed");
  }

  private processEventQueue(): void {
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

  retryFailedEvents(): void {
    if (this.failedEvents.length === 0) {
      this.logger.debug("No failed events to retry");
      return;
    }
    this.logger.info("Retrying failed events", {
      count: this.failedEvents.length,
    });
    const eventsToRetry = [...this.failedEvents];
    this.failedEvents = [];
    for (const event of eventsToRetry) {
      try {
        this.capture(event);
      } catch (error) {
        this.logger.error("Failed to retry event", {
          eventType: event.eventType,
          eventName: event.eventName,
          error: error instanceof Error ? error.message : String(error),
        });
        if (this.failedEvents.length < this.maxFailedEvents) {
          this.failedEvents.push(event);
        }
      }
    }
  }

  getFailedEventsCount(): number {
    return this.failedEvents.length;
  }
  getQueuedEventsCount(): number {
    return this.eventQueue.length;
  }
  getBufferedEventsCount(): number {
    return this.buffer.length;
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    try {
      if (!userId || typeof userId !== "string") {
        throw new Error("User ID is required and must be a string");
      }
      const sanitizedUserId = sanitizeString(userId, "userId");
      this.userId = sanitizedUserId;
      let sanitizedTraits: Record<string, unknown> = {};
      if (traits) {
        if (typeof traits !== "object" || Array.isArray(traits)) {
          throw new Error("Traits must be an object");
        }
        sanitizedTraits = sanitizePayload(traits);
      }
      const identifyEvent: TelemetryEvent = {
        eventType: "identify",
        eventName: "user_identified",
        payload: {
          userId: sanitizedUserId,
          traits: sanitizedTraits,
        },
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        userId: this.userId,
      };
      this.logger.info("User identified", {
        userId: sanitizedUserId,
        traits: Object.keys(sanitizedTraits),
      });
      this.capture(identifyEvent);
    } catch (error) {
      this.logger.error("Failed to identify user", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }
  getUserId(): string | undefined {
    return this.userId;
  }
  getCustomEventsPlugin(): CustomEventsPlugin | undefined {
    return this.customEventsPlugin;
  }
  getEndpoint(): string {
    function hasEndpoint(exporter: unknown): exporter is { endpoint: string } {
      return (
        typeof exporter === "object" &&
        exporter !== null &&
        "endpoint" in exporter &&
        typeof (exporter as Record<string, unknown>).endpoint === "string"
      );
    }
    return this.exporter && hasEndpoint(this.exporter)
      ? this.exporter.endpoint
      : "";
  }
}
