import { BasePlugin } from "../BasePlugin";
import type { TelemetryManager } from "../../TelemetryManager";
import { patchFetch, patchXHR } from "./utils/unifiedInterceptors";
import { patchEventSource } from "./utils/sseInterceptor";

export class NetworkPlugin extends BasePlugin {
  private unpatchFetch: (() => void) | null = null;
  private unpatchXHR: (() => void) | null = null;
  private unpatchEventSource: (() => void) | null = null;
  private telemetryEndpoint: string = "";
  private xhrHandlers = new WeakMap<XMLHttpRequest, () => void>();
  private patchedXHRs = new Set<XMLHttpRequest>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  public isSupported(): boolean {
    // Simple browser check for fetch and XMLHttpRequest
    return (
      typeof window !== "undefined" &&
      typeof window.fetch !== "undefined" &&
      typeof XMLHttpRequest !== "undefined"
    );
  }

  constructor() {
    super();
    // No need to store original fetch/XHR after unification
  }

  initialize(manager: TelemetryManager) {
    super.initialize(manager);
    this.telemetryEndpoint = manager.getEndpoint();
  }

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("NetworkPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      // Set up unified fetch interceptor
      this.unpatchFetch = patchFetch({
        handleTelemetryEvent: this.safeCapture.bind(this),
        telemetryEndpoint: this.telemetryEndpoint,
        logger: this.logger,
      });

      // Set up unified XHR interceptor
      if (typeof XMLHttpRequest !== "undefined") {
        this.unpatchXHR = patchXHR({
          handleTelemetryEvent: this.safeCapture.bind(this),
          telemetryEndpoint: this.telemetryEndpoint,
          logger: this.logger,
        });
        // Set up periodic cleanup to prevent memory leaks
        this.setupCleanupInterval();
      }

      // Set up EventSource (SSE) interceptor
      if (
        typeof window !== "undefined" &&
        typeof window.EventSource !== "undefined"
      ) {
        this.unpatchEventSource = patchEventSource({
          handleTelemetryEvent: this.safeCapture.bind(this),
          telemetryEndpoint: this.telemetryEndpoint,
          logger: this.logger,
          maxMessageSize: 10000, // 10KB per SSE message
          maxMessagesPerConnection: 1000, // Max 1000 messages per connection
        });
      }

      // Early events are now processed by the TelemetryManager itself
      this.logger.info(
        "NetworkPlugin setup complete - early events handled by TelemetryManager"
      );

      this.logger.info("NetworkPlugin setup complete with SSE support");
    } catch (error) {
      this.logger.error("Failed to setup NetworkPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  private setupCleanupInterval(): void {
    // Clean up dead XHR references every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadXHRs();
    }, 30000);
  }

  private cleanupDeadXHRs(): void {
    try {
      const deadXHRs: XMLHttpRequest[] = [];

      // Check for XHRs that are no longer valid
      this.patchedXHRs.forEach(xhr => {
        try {
          // Try to access a property to see if the XHR is still valid
          if (xhr.readyState === undefined) {
            deadXHRs.push(xhr);
          }
        } catch {
          // XHR is no longer valid
          deadXHRs.push(xhr);
        }
      });

      // Remove dead XHRs
      deadXHRs.forEach(xhr => {
        this.patchedXHRs.delete(xhr);
        this.xhrHandlers.delete(xhr);
      });

      if (deadXHRs.length > 0) {
        this.logger.debug("Cleaned up dead XHR references", {
          cleanedCount: deadXHRs.length,
          remainingCount: this.patchedXHRs.size,
        });
      }
    } catch (error) {
      this.logger.error("Failed to cleanup dead XHRs", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  teardown(): void {
    try {
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Restore fetch
      if (this.unpatchFetch) {
        this.unpatchFetch();
        this.unpatchFetch = null;
      }

      // Restore XMLHttpRequest only if it was available
      if (this.unpatchXHR) {
        this.unpatchXHR();
        this.unpatchXHR = null;
      }

      // Restore EventSource
      if (this.unpatchEventSource) {
        this.unpatchEventSource();
        this.unpatchEventSource = null;
      }

      // Clean up XHR handlers
      this.cleanupAllXHRHandlers();

      this.logger.info("NetworkPlugin teardown complete with SSE cleanup");
    } catch (error) {
      this.logger.error("Failed to teardown NetworkPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private cleanupAllXHRHandlers(): void {
    try {
      let cleanedCount = 0;
      this.patchedXHRs.forEach(xhr => {
        try {
          const cleanup = this.xhrHandlers.get(xhr);
          if (cleanup) {
            // Call the cleanup function to remove event listeners
            cleanup();
            cleanedCount++;
          }
        } catch (error) {
          this.logger.debug("Failed to cleanup XHR handler", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      this.patchedXHRs.clear();
      this.xhrHandlers = new WeakMap();

      this.logger.debug("Cleaned up XHR handlers", {
        cleanedCount,
      });
    } catch (error) {
      this.logger.error("Failed to cleanup XHR handlers", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
