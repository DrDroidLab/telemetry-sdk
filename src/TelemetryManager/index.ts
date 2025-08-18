import { HyperlookExporter } from "../exporters/HyperlookExporter";
import { HTTPExporter } from "../exporters/HTTPExporter";
import { getLogger, setLogger, createLogger } from "../logger";
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryPlugin,
  Logger,
  TelemetryExporter,
} from "../types";
import { ExporterType } from "../types/ExporterTypes";
import { validateConfig, generateSessionId } from "./utils";
import { TelemetryState } from "./types";
import { PluginManager } from "./PluginManager";
import { EventProcessor } from "./EventProcessor";
import { ExportManager } from "./ExportManager";

import { HYPERLOOK_URL } from "../constants";
import {
  earlyEventQueue,
  setupModuleLevelEarlyInterceptors,
} from "../utils/earlyInitialization";
import {
  clearUserProperties,
  clearAllUserProperties,
} from "../exporters/HyperlookExporter/utils";

// Set up interceptors immediately when module is loaded
setupModuleLevelEarlyInterceptors();

export class TelemetryManager {
  private state: TelemetryState = TelemetryState.INITIALIZING;
  private config: TelemetryConfig;
  private logger: Logger;
  private sessionId!: string;
  private userId?: string;
  private flushTimer: NodeJS.Timeout | undefined;
  private flushInterval: number;
  private failedEvents: TelemetryEvent[] = [];
  private maxFailedEvents = 1000;

  // Component managers
  private pluginManager: PluginManager;
  private eventProcessor: EventProcessor;
  private exportManager: ExportManager;

  // Early initialization support - removed unused singleton instance

  constructor(config: TelemetryConfig) {
    validateConfig(config);

    // Store config for later access
    this.config = config;

    // Early interceptors are already set up at module level
    // No need to set them up again

    // Initialize logger
    if (config.logging) {
      const customLogger = createLogger(config.logging);
      setLogger(customLogger);
    }
    this.logger = getLogger();

    // Initialize core properties
    this.sessionId = config.sessionId ?? generateSessionId();
    if (config.userId !== undefined) {
      this.userId = config.userId;
    }
    this.flushInterval = config.flushInterval ?? 30000;

    // Initialize component managers
    this.pluginManager = new PluginManager(this.logger, this.state);
    this.eventProcessor = new EventProcessor(
      this.logger,
      this.state,
      config.samplingRate ?? 1.0,
      config.batchSize ?? 50,
      this.sessionId,
      this.userId
    );

    // Instantiate exporters based on config
    const enabledExporters: TelemetryExporter[] = [];
    const exportersToEnable = config.exporters ?? [ExporterType.HYPERLOOK];
    for (const exporterType of exportersToEnable) {
      if (exporterType === ExporterType.HYPERLOOK) {
        if (!config.hyperlookApiKey) {
          throw new Error(
            "Hyperlook API key is required when Hyperlook exporter is enabled"
          );
        }
        enabledExporters.push(
          new HyperlookExporter(
            config.hyperlookApiKey,
            config.connectionTimeout,
            config.requestTimeout,
            config.hyperlookMaxBatchSize,
            config.hyperlookMaxPayloadSize
          )
        );
      } else if (exporterType === ExporterType.HTTP) {
        enabledExporters.push(
          new HTTPExporter(config.connectionTimeout, config.requestTimeout)
        );
      }
    }

    this.exportManager = new ExportManager(
      this.logger,
      enabledExporters,
      config.maxRetries ?? 5, // Increased default
      config.retryDelay ?? 1000,
      config.maxRetryDelay ?? 30000,
      config.endpoint
    );

    // Update circuit breaker configuration if provided
    if (
      config.circuitBreakerMaxFailures ||
      config.circuitBreakerTimeout ||
      config.circuitBreakerFailureThreshold
    ) {
      this.exportManager.updateCircuitBreaker(
        config.circuitBreakerMaxFailures,
        config.circuitBreakerTimeout,
        config.circuitBreakerFailureThreshold
      );
    }

    // Initialize plugins
    const pluginsToRegister = this.pluginManager.initializePlugins(config);
    pluginsToRegister.forEach(plugin => {
      this.pluginManager.register(plugin, this);
    });

    // Process any events that were queued before initialization
    this.processEarlyEventQueue();

    // Set state to running
    this.state = TelemetryState.RUNNING;
    this.pluginManager.setState(this.state);
    this.eventProcessor.setState(this.state);

    // Start flush timer
    this.startFlushTimer();

    this.logger.info("TelemetryManager initialized", {
      endpoint: HYPERLOOK_URL,
      batchSize: config.batchSize ?? 50,
      flushInterval: this.flushInterval,
      maxRetries: config.maxRetries ?? 5,
      retryDelay: config.retryDelay ?? 1000,
      maxRetryDelay: config.maxRetryDelay ?? 30000,
      connectionTimeout: config.connectionTimeout ?? 10000,
      requestTimeout: config.requestTimeout ?? 45000,
      circuitBreakerMaxFailures: config.circuitBreakerMaxFailures ?? 10,
      circuitBreakerTimeout: config.circuitBreakerTimeout ?? 60000,
      circuitBreakerFailureThreshold:
        config.circuitBreakerFailureThreshold ?? 0.5,
      hyperlookMaxBatchSize: config.hyperlookMaxBatchSize ?? 100,
      hyperlookMaxPayloadSize: config.hyperlookMaxPayloadSize ?? 1024 * 1024,
      samplingRate: config.samplingRate ?? 1.0,
      enablePageViews: config.enablePageViews,
      enableClicks: config.enableClicks,
      enableLogs: config.enableLogs,
      enableNetwork: config.enableNetwork,
      enablePerformance: config.enablePerformance,
      enableCustomEvents: config.enableCustomEvents,
      exporters: exportersToEnable,
    });
  }

  register(plugin: TelemetryPlugin): void {
    this.pluginManager.register(plugin, this);
  }

  capture(event: TelemetryEvent): void {
    const success = this.eventProcessor.capture(event);
    if (success) {
      // Process queue asynchronously
      this.processEventQueueAsync();

      // Check if buffer is full and trigger flush
      if (this.eventProcessor.isBufferFull()) {
        this.logger.info("Buffer full, triggering flush", {
          bufferSize: this.eventProcessor.getBufferSize(),
        });
        void this.flushAsync();
      }
    }
  }

  private processEventQueueAsync(): void {
    try {
      this.eventProcessor.processEventQueue();
    } catch (error) {
      this.logger.error("Async event queue processing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async flushAsync(): Promise<void> {
    try {
      await this.flush();
    } catch (error) {
      this.logger.error("Async flush failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startFlushTimer(): void {
    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (
          this.eventProcessor.getBufferSize() > 0 &&
          this.state === TelemetryState.RUNNING
        ) {
          this.logger.debug("Periodic flush triggered", {
            bufferSize: this.eventProcessor.getBufferSize(),
            flushInterval: this.flushInterval,
          });
          void this.flushAsync();
        }
      }, this.flushInterval);
    }
  }

  async flush(useBeacon: boolean = false): Promise<void> {
    const batch = this.eventProcessor.getBatchForExport();

    // Don't flush if no events
    if (batch.length === 0) {
      return;
    }

    // Use sendBeacon if explicitly requested or if we're in shutdown state
    const shouldUseBeacon =
      useBeacon ||
      this.state === TelemetryState.SHUTTING_DOWN ||
      this.state === TelemetryState.SHUTDOWN;
    const result = await this.exportManager.flush(batch, shouldUseBeacon);

    if (!result.success && result.shouldReturnToBuffer) {
      this.eventProcessor.returnBatchToBuffer(batch);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down TelemetryManager");
    this.state = TelemetryState.SHUTTING_DOWN;

    // Update state in all components
    this.pluginManager.setState(this.state);
    this.eventProcessor.setState(this.state);

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Destroy plugins
    this.pluginManager.destroyAll();

    // Final flush
    await this.flush();

    // Clear all data
    this.eventProcessor.clear();
    this.failedEvents = [];
    this.exportManager.setExporters([]);
    clearAllUserProperties();

    this.state = TelemetryState.SHUTDOWN;
    this.logger.info("TelemetryManager shutdown complete");
  }

  destroy(): void {
    this.logger.warn("Force destroying TelemetryManager");
    this.state = TelemetryState.SHUTDOWN;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    this.eventProcessor.clear();
    this.failedEvents = [];
    this.exportManager.setExporters([]);
    clearAllUserProperties();

    this.logger.info("TelemetryManager destroyed");
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
        // Check if we're at the limit before adding to failed events
        if (this.failedEvents.length < this.maxFailedEvents) {
          this.failedEvents.push(event);
        } else {
          this.logger.warn("Failed events limit reached, dropping event", {
            eventType: event.eventType,
            eventName: event.eventName,
            maxFailedEvents: this.maxFailedEvents,
          });
        }
      }
    }
  }

  getFailedEventsCount(): number {
    return this.failedEvents.length;
  }

  getQueuedEventsCount(): number {
    return this.eventProcessor.getQueueSize();
  }

  getBufferedEventsCount(): number {
    return this.eventProcessor.getBufferSize();
  }

  getState(): TelemetryState {
    return this.state;
  }

  getConfig(): TelemetryConfig {
    return this.config;
  }

  isShutdown(): boolean {
    return (
      this.state === TelemetryState.SHUTDOWN ||
      this.state === TelemetryState.SHUTTING_DOWN
    );
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    try {
      if (!userId || typeof userId !== "string") {
        throw new Error("User ID is required and must be a string");
      }

      // Validate traits if provided
      if (
        traits !== undefined &&
        (typeof traits !== "object" || traits === null)
      ) {
        throw new Error("Traits must be an object or undefined");
      }

      // Update userId in both TelemetryManager and EventProcessor
      this.userId = userId;
      this.eventProcessor.setUserId(userId);

      const identifyEvent: TelemetryEvent = {
        eventType: "identify",
        eventName: "user_identified",
        payload: {
          userId,
          traits: traits || {},
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.info("User identified", {
        userId,
        traits: Object.keys(traits || {}),
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

  clearUserIdentification(): void {
    if (this.userId) {
      clearUserProperties(this.userId);
    }
    delete this.userId;
    this.eventProcessor.setUserId("");
    this.logger.info("User identification cleared");
  }

  getCustomEventsPlugin() {
    return this.pluginManager.getCustomEventsPlugin();
  }

  getEndpoint(): string {
    return HYPERLOOK_URL;
  }

  getCircuitBreakerState() {
    return this.exportManager.getCircuitBreakerState();
  }

  private processEarlyEventQueue(): void {
    if (earlyEventQueue.length === 0) {
      return;
    }

    this.logger.info("Processing early event queue", {
      queuedEvents: earlyEventQueue.length,
    });

    // Process all queued events
    earlyEventQueue.forEach(event => {
      this.capture(event);
    });

    // Clear the queue
    earlyEventQueue.length = 0;
  }
}
