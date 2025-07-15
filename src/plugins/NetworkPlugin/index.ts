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

  protected isSupported(): boolean {
    return isNetworkSupported();
  }

  constructor() {
    super();
    if (this.isSupported()) {
      this.originalFetch = initializeOriginalFetch();
      this.originalXHROpen = createOriginalXHROpen();
      this.originalXHRSend = createOriginalXHRSend();
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
      });

      // Set up XHR interceptors
      const xhrInterceptors = setupXHRInterceptors({
        telemetryEndpoint: this.telemetryEndpoint,
        safeCapture: this.safeCapture.bind(this),
        xhrHandlers: this.xhrHandlers,
        patchedXHRs: this.patchedXHRs,
      });

      this.originalXHROpen = xhrInterceptors.originalOpen;
      this.originalXHRSend = xhrInterceptors.originalSend;

      this.logger.info("NetworkPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup NetworkPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    // Restore fetch
    if (this.unregister) {
      this.unregister();
      this.unregister = null;
    }

    // Restore XMLHttpRequest
    if (this.originalXHROpen && this.originalXHRSend) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
      XMLHttpRequest.prototype.send = this.originalXHRSend;
    }

    // Clean up XHR handlers
    this.patchedXHRs.forEach(xhr => {
      const handler = this.xhrHandlers.get(xhr);
      if (handler) {
        xhr.removeEventListener("load", handler);
        xhr.removeEventListener("error", handler);
        xhr.removeEventListener("abort", handler);
      }
    });

    this.patchedXHRs.clear();

    this.logger.info("NetworkPlugin teardown complete");
  }
}
