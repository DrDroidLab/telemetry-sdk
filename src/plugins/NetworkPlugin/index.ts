import { BasePlugin } from "../BasePlugin";
import type { TelemetryManager } from "../../TelemetryManager";
import {
  isNetworkSupported,
  initializeOriginalFetch,
  createOriginalXHROpen,
  createOriginalXHRSend,
  setupFetchInterceptor,
  setupXHRInterceptors,
} from "./utils";

export class NetworkPlugin extends BasePlugin {
  private originalFetch!: typeof fetch;
  private originalXHROpen!: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend!: typeof XMLHttpRequest.prototype.send;
  private unregister: (() => void) | null = null;
  private telemetryEndpoint: string = "";
  private xhrHandlers = new WeakMap<XMLHttpRequest, () => void>();
  private patchedXHRs = new Set<XMLHttpRequest>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  protected isSupported(): boolean {
    return isNetworkSupported();
  }

  constructor() {
    super();
    if (this.isSupported()) {
      this.originalFetch = initializeOriginalFetch();
      // Only initialize XHR if we're in a browser environment
      if (typeof XMLHttpRequest !== "undefined") {
        this.originalXHROpen = createOriginalXHROpen();
        this.originalXHRSend = createOriginalXHRSend();
      }
    }
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
      // Set up fetch interceptor
      this.unregister = setupFetchInterceptor({
        originalFetch: this.originalFetch,
        telemetryEndpoint: this.telemetryEndpoint,
        safeCapture: this.safeCapture.bind(this),
        logger: this.logger,
      });

      // Set up XHR interceptors only if XMLHttpRequest is available
      if (typeof XMLHttpRequest !== "undefined") {
        const xhrInterceptors = setupXHRInterceptors({
          telemetryEndpoint: this.telemetryEndpoint,
          safeCapture: this.safeCapture.bind(this),
          xhrHandlers: this.xhrHandlers,
          patchedXHRs: this.patchedXHRs,
        });

        this.originalXHROpen = xhrInterceptors.originalOpen;
        this.originalXHRSend = xhrInterceptors.originalSend;

        // Set up periodic cleanup to prevent memory leaks
        this.setupCleanupInterval();
      }

      this.logger.info("NetworkPlugin setup complete");
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
      if (this.unregister) {
        this.unregister();
        this.unregister = null;
      }

      // Restore XMLHttpRequest only if it was available
      if (
        typeof XMLHttpRequest !== "undefined" &&
        this.originalXHROpen &&
        this.originalXHRSend
      ) {
        try {
          XMLHttpRequest.prototype.open = this.originalXHROpen;
          XMLHttpRequest.prototype.send = this.originalXHRSend;
        } catch (error) {
          this.logger.error("Failed to restore XMLHttpRequest prototypes", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Clean up XHR handlers
      this.cleanupAllXHRHandlers();

      this.logger.info("NetworkPlugin teardown complete");
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
