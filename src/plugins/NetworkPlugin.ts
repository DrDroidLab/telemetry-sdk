import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";
import type { TelemetryManager } from "../TelemetryManager";

if (
  typeof window !== "undefined" &&
  !(window as unknown as Record<string, unknown>)._originalFetch
) {
  (window as unknown as Record<string, unknown>)._originalFetch = window.fetch;
}

export class NetworkPlugin extends BasePlugin {
  private originalFetch!: typeof fetch;
  private originalXHROpen!: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend!: typeof XMLHttpRequest.prototype.send;
  private unregister: (() => void) | null = null;
  private telemetryEndpoint: string = "";
  private xhrHandlers = new WeakMap<XMLHttpRequest, () => void>();
  private patchedXHRs = new Set<XMLHttpRequest>();

  protected isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof fetch !== "undefined" &&
      typeof XMLHttpRequest !== "undefined"
    );
  }

  constructor() {
    super();
    if (this.isSupported()) {
      this.originalFetch =
        ((window as unknown as Record<string, unknown>)
          ._originalFetch as typeof fetch) || window.fetch;
      this.originalXHROpen = function (
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        async?: boolean,
        user?: string | null,
        password?: string | null
      ) {
        return XMLHttpRequest.prototype.open.call(
          this,
          method,
          url,
          async === undefined ? true : async,
          user,
          password
        );
      };
      this.originalXHRSend = function (
        this: XMLHttpRequest,
        body?: Document | XMLHttpRequestBodyInit | null
      ) {
        return XMLHttpRequest.prototype.send.call(this, body);
      };
    }
  }

  initialize(manager: TelemetryManager) {
    super.initialize(manager);
    // Get endpoint from manager's getEndpoint method
    this.telemetryEndpoint = manager.getEndpoint();
  }

  private createFetchInterceptor() {
    // Create the interceptor function using arrow function to preserve context
    const interceptor = async (
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

      try {
        // Call the original fetch with proper context
        const response = await this.originalFetch.call(window, input, init);
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Don't capture telemetry requests to prevent infinite loops
        if (!this.telemetryEndpoint || !url.includes(this.telemetryEndpoint)) {
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

          this.safeCapture(evt);
        }
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Don't capture telemetry request errors either
        if (!this.telemetryEndpoint || !url.includes(this.telemetryEndpoint)) {
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

          this.safeCapture(evt);
        }
        throw error;
      }
    };

    // Copy all properties from the original fetch to maintain compatibility
    Object.setPrototypeOf(
      interceptor,
      Object.getPrototypeOf(this.originalFetch) as typeof fetch
    );

    // Copy all own properties
    const originalProperties = Object.getOwnPropertyDescriptors(
      this.originalFetch
    );
    Object.defineProperties(interceptor, originalProperties);

    // Replace the global fetch
    window.fetch = interceptor;

    // Return unregister function
    return () => {
      if ((window as unknown as Record<string, unknown>)._originalFetch) {
        window.fetch = (window as unknown as Record<string, unknown>)
          ._originalFetch as typeof fetch;
      }
    };
  }

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("NetworkPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      // Set up fetch interceptor
      this.unregister = this.createFetchInterceptor();

      // Patch XMLHttpRequest
      const originalOpen = (...args: Parameters<XMLHttpRequest["open"]>) =>
        XMLHttpRequest.prototype.open.apply(this, args);
      const originalSend = (...args: Parameters<XMLHttpRequest["send"]>) =>
        XMLHttpRequest.prototype.send.apply(this, args);

      XMLHttpRequest.prototype.open = (function (plugin) {
        return function (
          this: XMLHttpRequest,
          method: string,
          url: string | URL,
          async?: boolean,
          user?: string | null,
          password?: string | null
        ) {
          (this as unknown as Record<string, unknown>)._telemetryMethod =
            method;
          (this as unknown as Record<string, unknown>)._telemetryUrl =
            typeof url === "string" ? url : String(url);
          (this as unknown as Record<string, unknown>)._telemetryStartTime =
            performance.now();
          // Track this XHR instance for cleanup
          plugin.patchedXHRs.add(this);
          return originalOpen.call(
            this,
            method,
            url,
            async ?? true,
            user,
            password
          );
        };
      })(this);

      XMLHttpRequest.prototype.send = (function (plugin) {
        return function (
          this: XMLHttpRequest,
          body?: Document | XMLHttpRequestBodyInit | null
        ) {
          const startTime = (this as unknown as Record<string, unknown>)
            ._telemetryStartTime as number;
          const method = (this as unknown as Record<string, unknown>)
            ._telemetryMethod as string;
          const url = (this as unknown as Record<string, unknown>)
            ._telemetryUrl as string;

          // Don't capture telemetry requests to prevent infinite loops
          if (
            !plugin.telemetryEndpoint ||
            !url.includes(plugin.telemetryEndpoint)
          ) {
            const handler = function (this: XMLHttpRequest) {
              const endTime = performance.now();
              const duration = endTime - startTime;

              const evt: TelemetryEvent = {
                eventType: "network",
                eventName: "xhr",
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

              plugin.safeCapture(evt);
              plugin.xhrHandlers.delete(this);
            };

            this.addEventListener("load", handler);
            this.addEventListener("error", handler);
            this.addEventListener("abort", handler);
            plugin.xhrHandlers.set(this, handler);
          }

          return originalSend.call(this, body);
        };
      })(this);

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
    // WeakMap doesn't have clear() method, just let it be garbage collected

    this.logger.info("NetworkPlugin teardown complete");
  }
}
