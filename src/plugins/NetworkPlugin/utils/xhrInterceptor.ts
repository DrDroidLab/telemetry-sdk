import type { NetworkEvent } from "../types";

export type XHRInterceptorContext = {
  telemetryEndpoint: string;
  safeCapture: (event: NetworkEvent) => void;
  xhrHandlers: WeakMap<XMLHttpRequest, () => void>;
  patchedXHRs: Set<XMLHttpRequest>;
};

// Helper function to extract query parameters from URL
const extractQueryParams = (url: string): Record<string, string> => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : ""
    );
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
};

// Helper function to extract response headers
const extractResponseHeaders = (
  xhr: XMLHttpRequest
): Record<string, string> => {
  const headers: Record<string, string> = {};
  try {
    const headerString = xhr.getAllResponseHeaders();
    if (headerString) {
      headerString.split("\r\n").forEach(line => {
        const [key, value] = line.split(": ");
        if (key && value) {
          headers[key.toLowerCase()] = value;
        }
      });
    }
  } catch {
    // Ignore header extraction errors
  }
  return headers;
};

// Helper function to extract response body
const extractResponseBody = (xhr: XMLHttpRequest): unknown => {
  try {
    const responseText = xhr.responseText;
    if (responseText) {
      return JSON.parse(responseText);
    }
  } catch {
    // If JSON parsing fails, return the raw text
    return xhr.responseText;
  }
  return null;
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
      const handler = function (this: XMLHttpRequest) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const isSupabaseQuery =
          url.includes("supabase.co") || url.includes("supabase.com");
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
            status: this.status,
            statusText: this.statusText,
            responseHeaders: extractResponseHeaders(this),
            responseBody: extractResponseBody(this),
            duration,
            startTime,
            endTime: endTime,
            isSupabaseQuery,
          },
          timestamp: new Date().toISOString(),
        };

        safeCapture(evt);
        xhrHandlers.delete(this);
      };

      this.addEventListener("load", handler);
      this.addEventListener("error", handler);
      this.addEventListener("abort", handler);
      xhrHandlers.set(this, handler);
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
