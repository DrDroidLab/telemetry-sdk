import type { NetworkEvent } from "../types";
import {
  extractQueryParams,
  extractXHRResponseHeaders,
  extractXHRResponseBody,
} from "./index";
import { isSupabaseUrl } from "../../../utils";
import { HYPERLOOK_URL } from "../../../constants";

export type XHRInterceptorContext = {
  telemetryEndpoint: string;
  safeCapture: (event: NetworkEvent) => void;
  xhrHandlers: WeakMap<XMLHttpRequest, () => void>;
  patchedXHRs: Set<XMLHttpRequest>;
};

export const createXHROpenInterceptor = (context: XHRInterceptorContext) => {
  const { patchedXHRs } = context;

  const originalOpen = (...args: Parameters<XMLHttpRequest["open"]>) =>
    XMLHttpRequest.prototype.open.apply(this, args);

  return function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    password?: string | null
  ) {
    // Filter out requests to the Hyperlook ingestion URL
    if (typeof url === "string" && url.includes(HYPERLOOK_URL)) {
      return originalOpen.call(
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

    patchedXHRs.add(this);

    return originalOpen.call(this, method, url, async ?? true, user, password);
  };
};

export const createXHRSendInterceptor = (context: XHRInterceptorContext) => {
  const { telemetryEndpoint, safeCapture, xhrHandlers } = context;

  const originalSend = (...args: Parameters<XMLHttpRequest["send"]>) =>
    XMLHttpRequest.prototype.send.apply(this, args);

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

    if (!telemetryEndpoint || !url.includes(telemetryEndpoint)) {
      const isSupabaseQuery = isSupabaseUrl(url);

      // Track if we've already captured an event for this XHR to prevent duplicates
      let eventCaptured = false;

      // Success handler
      const successHandler = function (this: XMLHttpRequest) {
        if (eventCaptured) return; // Prevent duplicate events
        eventCaptured = true;

        const endTime = performance.now();
        const duration = endTime - startTime;
        const eventName = isSupabaseQuery
          ? "supabase_xhr_complete"
          : "xhr_complete";
        const eventType = isSupabaseQuery ? "supabase" : "network";

        const evt: NetworkEvent = {
          eventType: eventType,
          eventName: eventName,
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
            endTime: endTime,
            isSupabaseQuery,
          },
          timestamp: new Date().toISOString(),
        };

        safeCapture(evt);
        cleanup();
      };

      // Error handler
      const errorHandler = function (this: XMLHttpRequest) {
        if (eventCaptured) return; // Prevent duplicate events
        eventCaptured = true;

        const endTime = performance.now();
        const duration = endTime - startTime;
        const eventName = isSupabaseQuery ? "supabase_xhr_error" : "xhr_error";
        const eventType = isSupabaseQuery ? "supabase" : "network";

        const evt: NetworkEvent = {
          eventType: eventType,
          eventName: eventName,
          payload: {
            url,
            method,
            queryParams: extractQueryParams(url),
            responseStatus: this.status,
            responseStatusText: this.statusText,
            error: "XHR request failed",
            duration,
            startTime,
            endTime: endTime,
            isSupabaseQuery,
          },
          timestamp: new Date().toISOString(),
        };

        safeCapture(evt);
        cleanup();
      };

      // Abort handler (treat as error)
      const abortHandler = function (this: XMLHttpRequest) {
        if (eventCaptured) return; // Prevent duplicate events
        eventCaptured = true;

        const endTime = performance.now();
        const duration = endTime - startTime;
        const eventName = isSupabaseQuery ? "supabase_xhr_error" : "xhr_error";
        const eventType = isSupabaseQuery ? "supabase" : "network";

        const evt: NetworkEvent = {
          eventType: eventType,
          eventName: eventName,
          payload: {
            url,
            method,
            queryParams: extractQueryParams(url),
            responseStatus: this.status,
            responseStatusText: this.statusText,
            error: "XHR request aborted",
            duration,
            startTime,
            endTime: endTime,
            isSupabaseQuery,
          },
          timestamp: new Date().toISOString(),
        };

        safeCapture(evt);
        cleanup();
      };

      // Cleanup function
      const cleanup = () => {
        this.removeEventListener("load", successHandler);
        this.removeEventListener("error", errorHandler);
        this.removeEventListener("abort", abortHandler);
        xhrHandlers.delete(this);
      };

      // Store handlers for later cleanup
      xhrHandlers.set(this, cleanup);

      this.addEventListener("load", successHandler);
      this.addEventListener("error", errorHandler);
      this.addEventListener("abort", abortHandler);
    }

    return originalSend.call(this, body);
  };
};

export const setupXHRInterceptors = (context: XHRInterceptorContext) => {
  const openInterceptor = createXHROpenInterceptor(context);
  const sendInterceptor = createXHRSendInterceptor(context);

  XMLHttpRequest.prototype.open = openInterceptor;
  XMLHttpRequest.prototype.send = sendInterceptor;

  return {
    originalOpen: openInterceptor,
    originalSend: sendInterceptor,
  };
};
