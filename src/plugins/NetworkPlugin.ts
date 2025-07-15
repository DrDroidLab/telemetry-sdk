import { BasePlugin } from "./BasePlugin";
import { getLogger } from "../logger";
import type { TelemetryEvent } from "../types";
import type { TelemetryManager } from "../TelemetryManager";

if (typeof window !== "undefined" && !(window as any)._originalFetch) {
  (window as any)._originalFetch = window.fetch;
}

export class NetworkPlugin extends BasePlugin {
  private logger = getLogger();
  private originalFetch: typeof fetch;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send;
  private unregister: (() => void) | null = null;

  constructor() {
    super();
    this.originalFetch = (window as any)._originalFetch || window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
  }

  initialize(manager: TelemetryManager) {
    super.initialize(manager);
  }

  private createFetchInterceptor() {
    const self = this;

    // Create the interceptor function
    const interceptor = async function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      const startTime = performance.now();
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";

      try {
        // Call the original fetch with proper context
        const response = await self.originalFetch.call(window, input, init);
        const endTime = performance.now();
        const duration = endTime - startTime;

        const evt: TelemetryEvent = {
          eventType: "network",
          eventName: "fetch",
          payload: {
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            duration,
            timestamp: new Date().toISOString(),
            type: "fetch",
          },
          timestamp: new Date().toISOString(),
        };

        self.manager.capture(evt);
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        const evt: TelemetryEvent = {
          eventType: "network",
          eventName: "fetch_error",
          payload: {
            url,
            method,
            error: error instanceof Error ? error.message : String(error),
            duration,
            timestamp: new Date().toISOString(),
            type: "fetch",
          },
          timestamp: new Date().toISOString(),
        };

        self.manager.capture(evt);
        throw error;
      }
    };

    // Copy all properties from the original fetch to maintain compatibility
    Object.setPrototypeOf(
      interceptor,
      Object.getPrototypeOf(this.originalFetch),
    );

    // Copy all own properties
    const originalProperties = Object.getOwnPropertyDescriptors(
      this.originalFetch,
    );
    Object.defineProperties(interceptor, originalProperties);

    // Replace the global fetch
    window.fetch = interceptor;

    // Return unregister function
    return () => {
      if ((window as any)._originalFetch) {
        window.fetch = (window as any)._originalFetch;
      }
    };
  }

  protected setup(): void {
    // Set up fetch interceptor
    this.unregister = this.createFetchInterceptor();

    // Patch XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      password?: string | null,
    ) {
      (this as any)._telemetryMethod = method;
      (this as any)._telemetryUrl =
        typeof url === "string" ? url : url.toString();
      return originalOpen.call(
        this,
        method,
        url,
        async ?? true,
        user,
        password,
      );
    };

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const method = (this as any)._telemetryMethod;
      const url = (this as any)._telemetryUrl;

      if (method && url) {
        const startTime = performance.now();
        const originalOnReadyStateChange = this.onreadystatechange;

        this.onreadystatechange = function () {
          if (this.readyState === XMLHttpRequest.DONE) {
            const endTime = performance.now();
            const duration = endTime - startTime;

            const evt: TelemetryEvent = {
              eventType: "network",
              eventName: this.status >= 400 ? "xhr_error" : "xhr",
              payload: {
                url,
                method,
                status: this.status,
                statusText: this.statusText,
                duration,
                timestamp: new Date().toISOString(),
                type: "xhr",
              },
              timestamp: new Date().toISOString(),
            };

            self.manager.capture(evt);
          }

          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(
              this,
              new Event("readystatechange"),
            );
          }
        };
      }

      return originalSend.call(this, body);
    };

    this.logger.info("NetworkPlugin setup complete");
  }

  teardown(): void {
    // Unregister fetch interceptor
    if (this.unregister) {
      this.unregister();
      this.unregister = null;
    }

    // Restore original XMLHttpRequest methods
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    XMLHttpRequest.prototype.send = this.originalXHRSend;

    this.logger.info("NetworkPlugin teardown complete");
  }
}
