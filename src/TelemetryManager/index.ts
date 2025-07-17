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

// Global early event queue for requests made before SDK initialization
const earlyEventQueue: TelemetryEvent[] = [];
let earlyInterceptorsSetup = false;

export class TelemetryManager {
  private state: TelemetryState = TelemetryState.INITIALIZING;
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

    // Set up early network interceptors immediately
    this.setupEarlyInterceptors();

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
        enabledExporters.push(new HyperlookExporter(config.hyperlookApiKey));
      } else if (exporterType === ExporterType.HTTP) {
        enabledExporters.push(new HTTPExporter());
      }
    }

    this.exportManager = new ExportManager(
      this.logger,
      enabledExporters,
      config.maxRetries ?? 3,
      config.retryDelay ?? 1000,
      config.endpoint
    );

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
      maxRetries: config.maxRetries ?? 3,
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

  async flush(): Promise<void> {
    const batch = this.eventProcessor.getBatchForExport();
    const result = await this.exportManager.flush(batch);

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

      this.userId = userId;

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

  getCustomEventsPlugin() {
    return this.pluginManager.getCustomEventsPlugin();
  }

  getEndpoint(): string {
    return HYPERLOOK_URL;
  }

  // Early initialization methods
  private setupEarlyInterceptors(): void {
    if (earlyInterceptorsSetup) {
      return;
    }

    // Set up early fetch interceptor
    this.setupEarlyFetchInterceptor();

    // Set up early XHR interceptor
    if (typeof XMLHttpRequest !== "undefined") {
      this.setupEarlyXHRInterceptors();
    }

    earlyInterceptorsSetup = true;
  }

  private setupEarlyFetchInterceptor(): void {
    const originalFetch =
      typeof window !== "undefined" ? window.fetch : globalThis.fetch;

    const earlyFetchInterceptor = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const startTime = performance.now();
      let url: string;

      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (typeof (input as { url?: string }).url === "string") {
        url = (input as { url: string }).url;
      } else {
        url = JSON.stringify(input);
      }

      const method = init?.method || "GET";

      // Filter out requests to the Hyperlook ingestion URL
      if (url.includes(HYPERLOOK_URL)) {
        return originalFetch.call(
          typeof window !== "undefined" ? window : globalThis,
          input,
          init
        );
      }

      try {
        const response = await originalFetch.call(
          typeof window !== "undefined" ? window : globalThis,
          input,
          init
        );
        const endTime = performance.now();

        // Queue the request for later processing
        this.queueEarlyEvent("network", "fetch_complete", {
          url,
          method,
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: this.extractResponseHeaders(response),
          responseBody: await this.extractResponseBody(response),
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: this.isSupabaseUrl(url),
          queryParams: this.extractQueryParams(url),
        });

        return response;
      } catch (error) {
        const endTime = performance.now();

        // Queue the failed request for later processing
        this.queueEarlyEvent("network", "fetch_error", {
          url,
          method,
          error: error instanceof Error ? error.message : String(error),
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: this.isSupabaseUrl(url),
          queryParams: this.extractQueryParams(url),
        });

        throw error;
      }
    };

    // No prototype or property copying for fetch, just assign the interceptor directly.
    if (typeof window !== "undefined") {
      (window as unknown as { fetch: typeof fetch }).fetch =
        earlyFetchInterceptor;
    } else {
      (globalThis as { fetch: typeof fetch }).fetch = earlyFetchInterceptor;
    }
  }

  private setupEarlyXHRInterceptors(): void {
    const originalXHROpen = XMLHttpRequest.prototype.open.bind(
      XMLHttpRequest.prototype
    );
    const originalXHRSend = XMLHttpRequest.prototype.send.bind(
      XMLHttpRequest.prototype
    );
    const xhrHandlers = new WeakMap<XMLHttpRequest, () => void>();

    // Early XHR open interceptor
    const earlyXHROpenInterceptor = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      password?: string | null
    ) {
      // Filter out requests to the Hyperlook ingestion URL
      if (typeof url === "string" && url.includes(HYPERLOOK_URL)) {
        return originalXHROpen.call(
          this,
          method,
          url,
          async ?? true,
          user,
          password
        );
      }

      (this as unknown as Record<string, unknown>)._telemetryMethod = method;
      (this as unknown as Record<string, unknown>)._telemetryUrl =
        typeof url === "string" ? url : String(url);
      (this as unknown as Record<string, unknown>)._telemetryStartTime =
        performance.now();

      return originalXHROpen.call(
        this,
        method,
        url,
        async ?? true,
        user,
        password
      );
    };

    // Early XHR send interceptor
    const earlyXHRSendInterceptor = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      const startTime = (this as unknown as Record<string, unknown>)
        ._telemetryStartTime as number;
      const method = (this as unknown as Record<string, unknown>)
        ._telemetryMethod as string;
      const url = (this as unknown as Record<string, unknown>)
        ._telemetryUrl as string;

      let eventCaptured = false;

      // Success handler
      const successHandler = function (this: XMLHttpRequest) {
        if (eventCaptured) return;
        eventCaptured = true;

        const endTime = performance.now();

        // Queue the request for later processing
        TelemetryManager.queueEarlyEventStatic("network", "xhr_complete", {
          url,
          method,
          responseStatus: this.status,
          responseStatusText: this.statusText,
          responseHeaders: TelemetryManager.extractXHRResponseHeaders(this),
          responseBody: TelemetryManager.extractXHRResponseBody(this),
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: TelemetryManager.isSupabaseUrl(url),
          queryParams: TelemetryManager.extractQueryParams(url),
        });

        cleanup();
      }.bind(this);

      // Error handler
      const errorHandler = function (this: XMLHttpRequest) {
        if (eventCaptured) return;
        eventCaptured = true;

        const endTime = performance.now();

        // Queue the failed request for later processing
        TelemetryManager.queueEarlyEventStatic("network", "xhr_error", {
          url,
          method,
          responseStatus: this.status,
          responseStatusText: this.statusText,
          error: "XHR request failed",
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: TelemetryManager.isSupabaseUrl(url),
          queryParams: TelemetryManager.extractQueryParams(url),
        });

        cleanup();
      }.bind(this);

      // Abort handler
      const abortHandler = function (this: XMLHttpRequest) {
        if (eventCaptured) return;
        eventCaptured = true;

        const endTime = performance.now();

        // Queue the aborted request for later processing
        TelemetryManager.queueEarlyEventStatic("network", "xhr_error", {
          url,
          method,
          responseStatus: this.status,
          responseStatusText: this.statusText,
          error: "XHR request aborted",
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: TelemetryManager.isSupabaseUrl(url),
          queryParams: TelemetryManager.extractQueryParams(url),
        });

        cleanup();
      }.bind(this);

      // Cleanup function
      const cleanup = () => {
        this.removeEventListener("load", successHandler as EventListener);
        this.removeEventListener("error", errorHandler as EventListener);
        this.removeEventListener("abort", abortHandler as EventListener);
        xhrHandlers.delete(this);
      };

      // Store handlers for later cleanup
      xhrHandlers.set(this, cleanup);

      this.addEventListener("load", successHandler as EventListener);
      this.addEventListener("error", errorHandler as EventListener);
      this.addEventListener("abort", abortHandler as EventListener);

      return originalXHRSend.call(this, body);
    };

    // Replace XHR prototypes
    XMLHttpRequest.prototype.open = earlyXHROpenInterceptor;
    XMLHttpRequest.prototype.send = earlyXHRSendInterceptor;
  }

  private queueEarlyEvent(
    eventType: string,
    eventName: string,
    payload: Record<string, unknown>
  ): void {
    earlyEventQueue.push({
      eventType,
      eventName,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  private static queueEarlyEventStatic(
    eventType: string,
    eventName: string,
    payload: Record<string, unknown>
  ): void {
    earlyEventQueue.push({
      eventType,
      eventName,
      payload,
      timestamp: new Date().toISOString(),
    });
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

  // Helper functions
  private isSupabaseUrl(url: string): boolean {
    return url.includes("supabase.co") || url.includes("supabase.com");
  }

  private extractQueryParams(url: string): Record<string, string> {
    try {
      const urlObj = new URL(
        url,
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost"
      );
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch {
      return {};
    }
  }

  private async extractResponseBody(response: Response): Promise<string> {
    try {
      const clone = response.clone();
      const text = await clone.text();
      return text.length > 1000 ? text.substring(0, 1000) + "..." : text;
    } catch {
      return "";
    }
  }

  private extractResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private static extractXHRResponseHeaders(
    xhr: XMLHttpRequest
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerString = xhr.getAllResponseHeaders();
    if (headerString) {
      headerString.split("\r\n").forEach(line => {
        const [key, value] = line.split(": ");
        if (key && value) {
          headers[key.toLowerCase()] = value;
        }
      });
    }
    return headers;
  }

  private static extractXHRResponseBody(xhr: XMLHttpRequest): string {
    try {
      const responseText = xhr.responseText || "";
      return responseText.length > 1000
        ? responseText.substring(0, 1000) + "..."
        : responseText;
    } catch {
      return "";
    }
  }

  private static isSupabaseUrl(url: string): boolean {
    return url.includes("supabase.co") || url.includes("supabase.com");
  }

  private static extractQueryParams(url: string): Record<string, string> {
    try {
      const urlObj = new URL(
        url,
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost"
      );
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch {
      return {};
    }
  }
}
