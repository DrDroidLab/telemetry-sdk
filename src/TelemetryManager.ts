import { HTTPExporter } from "./exporters";
import { getLogger, setLogger, createLogger } from "./logger";
import { CustomEventsPlugin } from "./plugins";
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryExporter,
  TelemetryPlugin,
  Logger,
} from "./types";

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

  constructor(config: TelemetryConfig) {
    this.validateConfig(config);
    this.exporter = new HTTPExporter(config.endpoint);
    this.batchSize = config.batchSize ?? 50;
    this.flushInterval = config.flushInterval ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.samplingRate = config.samplingRate ?? 1.0;

    // Initialize session ID
    this.sessionId = config.sessionId ?? this.generateSessionId();

    // Initialize user ID if provided
    if (config.userId) {
      this.userId = config.userId;
    }

    // Initialize logger
    if (config.logging) {
      const customLogger = createLogger(config.logging);
      setLogger(customLogger);
    }
    this.logger = getLogger();

    // Initialize custom events plugin if enabled
    if (config.enableCustomEvents) {
      this.customEventsPlugin = new CustomEventsPlugin();
      this.register(this.customEventsPlugin);
    }

    // Start periodic flush timer
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
      // Remove the plugin from the array if initialization failed
      this.plugins.pop();
    }
  }

  /**
   * Validate and sanitize telemetry event data
   */
  private validateEvent(event: TelemetryEvent): TelemetryEvent {
    // Validate required fields
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
    // Validate timestamp format
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(event.timestamp)) {
      throw new Error("Invalid timestamp format. Expected ISO 8601 format");
    }
    // Sanitize string fields
    const sanitizedEvent: TelemetryEvent = {
      ...event,
      eventType: this.sanitizeString(event.eventType, "eventType"),
      eventName: this.sanitizeString(event.eventName, "eventName"),
      payload: this.sanitizePayload(event.payload),
    };
    return sanitizedEvent;
  }
  private sanitizeString(input: string, fieldName: string): string {
    if (typeof input !== "string") {
      throw new Error(`${fieldName} must be a string`);
    }
    // Remove null bytes and control characters without regex
    let sanitized = "";
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      if ((code > 31 && code !== 127) || code === 10 || code === 13) {
        sanitized += input[i];
      }
    }
    sanitized = sanitized.trim();
    if (sanitized.length === 0) throw new Error(`${fieldName} cannot be empty`);
    if (sanitized.length > 1000)
      throw new Error(`${fieldName} is too long (max 1000 characters)`);
    return sanitized;
  }
  private sanitizePayload(
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload must be an object");
    }
    const sanitized: Record<string, unknown> = {};
    const keys = Object.keys(payload);
    if (keys.length > 100) {
      throw new Error("Payload has too many keys (max 100)");
    }
    for (const key of keys) {
      const sanitizedKey = this.sanitizeString(key, "payload key");
      const value = payload[key];
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean" &&
        !Array.isArray(value) &&
        typeof value !== "object"
      ) {
        throw new Error(`Invalid payload value type for key '${sanitizedKey}'`);
      }
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[sanitizedKey] = this.sanitizePayload(
          value as Record<string, unknown>
        );
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    return sanitized;
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
      // Validate and sanitize the event
      const validatedEvent = this.validateEvent(evt);
      // Apply sampling
      if (Math.random() > this.samplingRate) {
        this.logger.debug("Event dropped due to sampling", {
          eventType: validatedEvent.eventType,
          eventName: validatedEvent.eventName,
          samplingRate: this.samplingRate,
        });
        return;
      }
      // Add session and user context to the event
      const enrichedEvent: TelemetryEvent = {
        ...validatedEvent,
        sessionId: this.sessionId,
        ...(this.userId && { userId: this.userId }),
      };
      // Add event to queue for proper ordering
      this.eventQueue.push(enrichedEvent);
      this.logger.debug("Event queued", {
        eventType: validatedEvent.eventType,
        eventName: validatedEvent.eventName,
        queueSize: this.eventQueue.length,
        sessionId: this.sessionId,
        userId: this.userId,
      });
      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        void this.processEventQueue();
      }
      // Check if we should flush
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

  private isFlushing = false;

  async flush() {
    if (!this.buffer.length) {
      this.logger.debug("No events to flush");
      return;
    }

    // Prevent concurrent flush operations
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
            // Wait before retrying
            await new Promise(resolve =>
              setTimeout(resolve, this.retryDelay * retries)
            );
          } else {
            // Re-add events to buffer on final failure
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

  /**
   * Shutdown the telemetry manager and cleanup all resources
   * This should be called when the telemetry instance is no longer needed
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down TelemetryManager");

    // Stop accepting new events
    this.isShutdown = true;

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Teardown all plugins
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

    // Flush any remaining events
    await this.flush();

    // Clear all references
    this.plugins = [];
    this.buffer = [];
    this.exporter = null;

    this.logger.info("TelemetryManager shutdown complete");
  }

  /**
   * Force destroy the telemetry manager (for strict mode cleanup)
   * This immediately stops all operations and clears all data
   */
  destroy(): void {
    this.logger.warn("Force destroying TelemetryManager");

    // Stop accepting new events
    this.isShutdown = true;

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Immediately clear all data without flushing
    this.buffer = [];
    this.plugins = [];
    this.exporter = null;

    this.logger.info("TelemetryManager destroyed");
  }

  /**
   * Check if the telemetry manager is shutdown
   */
  isShutdown = false;

  private validateConfig(config: TelemetryConfig): void {
    if (!config.endpoint || config.endpoint.trim() === "") {
      throw new Error("Telemetry endpoint is required");
    }

    try {
      new URL(config.endpoint);
    } catch {
      throw new Error("Invalid endpoint URL format");
    }

    if (
      config.samplingRate !== undefined &&
      (config.samplingRate < 0 || config.samplingRate > 1)
    ) {
      throw new Error("Sampling rate must be between 0 and 1");
    }

    if (config.batchSize !== undefined && config.batchSize <= 0) {
      throw new Error("Batch size must be greater than 0");
    }

    if (config.flushInterval !== undefined && config.flushInterval < 0) {
      throw new Error("Flush interval must be non-negative");
    }

    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new Error("Max retries must be non-negative");
    }

    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      throw new Error("Retry delay must be non-negative");
    }
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
          // Add to buffer for batching
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

  /**
   * Retry failed events (useful for recovery scenarios)
   */
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
        // Add back to failed events if retry fails
        if (this.failedEvents.length < this.maxFailedEvents) {
          this.failedEvents.push(event);
        }
      }
    }
  }

  /**
   * Get the count of failed events
   */
  getFailedEventsCount(): number {
    return this.failedEvents.length;
  }

  /**
   * Get the count of queued events
   */
  getQueuedEventsCount(): number {
    return this.eventQueue.length;
  }

  /**
   * Get the count of buffered events
   */
  getBufferedEventsCount(): number {
    return this.buffer.length;
  }

  /**
   * Identify a user with the given user ID and optional traits
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    try {
      // Validate user ID
      if (!userId || typeof userId !== "string") {
        throw new Error("User ID is required and must be a string");
      }
      const sanitizedUserId = this.sanitizeString(userId, "userId");
      this.userId = sanitizedUserId;
      // Validate and sanitize traits
      let sanitizedTraits: Record<string, unknown> = {};
      if (traits) {
        if (typeof traits !== "object" || Array.isArray(traits)) {
          throw new Error("Traits must be an object");
        }
        sanitizedTraits = this.sanitizePayload(traits);
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

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Get the custom events plugin for capturing custom events
   */
  getCustomEventsPlugin(): CustomEventsPlugin | undefined {
    return this.customEventsPlugin;
  }

  /**
   * Get the telemetry endpoint URL
   */
  getEndpoint(): string {
    // Type guard for HTTPExporter
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

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
