import type { NetworkEvent } from "../types";

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

        const evt: NetworkEvent = {
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
