import type { TelemetryEvent } from "../../../../types";
import type { Logger } from "../../../../types/Logger";
import type { NetworkEventPayload } from "../../types/NetworkEvent";
import { extractQueryParams } from "../extractQueryParams";
import { extractXHRResponseHeaders } from "../extractResponseHeaders";
import { extractXHRResponseBody } from "../extractResponseBody";

export interface XHRInterceptorOptions {
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void;
  shouldCaptureRequest?: (url: string) => boolean;
  telemetryEndpoint?: string;
  logger?: Logger;
}

export function patchXHR({
  handleTelemetryEvent,
  shouldCaptureRequest,
  telemetryEndpoint,
  logger,
}: XHRInterceptorOptions): () => void {
  const originalOpen = XMLHttpRequest.prototype.open.bind(
    XMLHttpRequest.prototype
  );
  const originalSend = XMLHttpRequest.prototype.send.bind(
    XMLHttpRequest.prototype
  );
  const xhrHandlers = new WeakMap<XMLHttpRequest, () => void>();
  const patchedXHRs = new Set<XMLHttpRequest>();

  const defaultShouldCapture = (url: string) => {
    if (telemetryEndpoint && url.includes(telemetryEndpoint)) return false;
    if (url.includes("hyperlook")) return false;
    return true;
  };
  const captureCheck = shouldCaptureRequest || defaultShouldCapture;

  const openInterceptor = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    password?: string | null
  ) {
    const urlStr = typeof url === "string" ? url : String(url);
    const self = this as XMLHttpRequest & Record<string, unknown>;
    self._telemetryMethod = method;
    self._telemetryUrl = urlStr;
    self._telemetryStartTime = performance.now();
    patchedXHRs.add(this);
    return originalOpen.call(this, method, url, async ?? true, user, password);
  };

  const sendInterceptor = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const self = this as XMLHttpRequest & Record<string, unknown>;
    const startTime = self._telemetryStartTime as number;
    const method = self._telemetryMethod as string;
    const url = self._telemetryUrl as string;
    if (!captureCheck(url)) {
      return originalSend.call(this, body);
    }
    let eventCaptured = false;
    const isSupabase = url.includes("supabase");
    const cleanup = () => {
      this.removeEventListener("load", successHandler);
      this.removeEventListener("error", errorHandler);
      this.removeEventListener("abort", abortHandler);
      xhrHandlers.delete(this);
    };
    const successHandler = function (this: XMLHttpRequest) {
      if (eventCaptured) return;
      eventCaptured = true;
      const endTime = performance.now();
      const duration = endTime - startTime;
      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: isSupabase ? "supabase" : "network",
        eventName: isSupabase ? "supabase_xhr_complete" : "xhr_complete",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          responseStatus: this.status,
          responseStatusText: this.statusText,
          responseHeaders: extractXHRResponseHeaders(this),
          responseBody: extractXHRResponseBody(this),
          duration,
          startTime,
          endTime,
          isSupabaseQuery: isSupabase,
        },
        timestamp: new Date().toISOString(),
      };
      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in XHR", { error: err });
        throw err;
      }
      cleanup();
    };
    const errorHandler = function (this: XMLHttpRequest) {
      if (eventCaptured) return;
      eventCaptured = true;
      const endTime = performance.now();
      const duration = endTime - startTime;
      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: isSupabase ? "supabase" : "network",
        eventName: isSupabase ? "supabase_xhr_error" : "xhr_error",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          responseStatus: this.status,
          responseStatusText: this.statusText,
          error: "XHR request failed",
          duration,
          startTime,
          endTime,
          isSupabaseQuery: isSupabase,
        },
        timestamp: new Date().toISOString(),
      };
      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in XHR (error case)", {
          error: err,
        });
        throw err;
      }
      cleanup();
    };
    const abortHandler = function (this: XMLHttpRequest) {
      if (eventCaptured) return;
      eventCaptured = true;
      const endTime = performance.now();
      const duration = endTime - startTime;
      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: isSupabase ? "supabase" : "network",
        eventName: isSupabase ? "supabase_xhr_error" : "xhr_error",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          responseStatus: this.status,
          responseStatusText: this.statusText,
          error: "XHR request aborted",
          duration,
          startTime,
          endTime,
          isSupabaseQuery: isSupabase,
        },
        timestamp: new Date().toISOString(),
      };
      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in XHR (abort case)", {
          error: err,
        });
        throw err;
      }
      cleanup();
    };
    xhrHandlers.set(this, cleanup);
    this.addEventListener("load", successHandler);
    this.addEventListener("error", errorHandler);
    this.addEventListener("abort", abortHandler);
    return originalSend.call(this, body);
  };

  XMLHttpRequest.prototype.open = openInterceptor;
  XMLHttpRequest.prototype.send = sendInterceptor;

  // Return unpatch function
  return () => {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    patchedXHRs.clear();
    // No clear() on WeakMap, but GC will clean up
  };
}
