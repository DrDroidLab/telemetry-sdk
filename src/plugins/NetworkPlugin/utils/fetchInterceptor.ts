import type { NetworkEvent } from "../types";

export type FetchInterceptorContext = {
  originalFetch: typeof fetch;
  telemetryEndpoint: string;
  safeCapture: (event: NetworkEvent) => void;
};

export const createFetchInterceptor = (context: FetchInterceptorContext) => {
  const { originalFetch, telemetryEndpoint, safeCapture } = context;

  const interceptor = async (input: RequestInfo | URL, init?: RequestInit) => {
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
      const response = await originalFetch.call(window, input, init);
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!telemetryEndpoint || !url.includes(telemetryEndpoint)) {
        const isSupabaseQuery =
          url.includes("supabase.co") || url.includes("supabase.com");
        const eventName = isSupabaseQuery
          ? "supabase_fetch_complete"
          : "fetch_complete";
        const eventType = isSupabaseQuery ? "supabase" : "network";

        const evt: NetworkEvent = {
          eventType: eventType,
          eventName: eventName,
          payload: {
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            duration,
            startTime,
            endTime: endTime,
            isSupabaseQuery,
          },
          timestamp: new Date().toISOString(),
        };

        safeCapture(evt);
      }
      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!telemetryEndpoint || !url.includes(telemetryEndpoint)) {
        const isSupabaseQuery =
          url.includes("supabase.co") || url.includes("supabase.com");
        const eventName = isSupabaseQuery
          ? "supabase_fetch_error"
          : "fetch_error";
        const eventType = isSupabaseQuery ? "supabase" : "network";

        const evt: NetworkEvent = {
          eventType: eventType,
          eventName: eventName,
          payload: {
            url,
            method,
            error: error instanceof Error ? error.message : String(error),
            duration,
            startTime,
            endTime: endTime,
            isSupabaseQuery,
          },
          timestamp: new Date().toISOString(),
        };

        safeCapture(evt);
      }
      throw error;
    }
  };

  // Copy all properties from the original fetch to maintain compatibility
  Object.setPrototypeOf(
    interceptor,
    Object.getPrototypeOf(originalFetch) as typeof fetch
  );

  const originalProperties = Object.getOwnPropertyDescriptors(originalFetch);
  Object.defineProperties(interceptor, originalProperties);

  return interceptor;
};

export const setupFetchInterceptor = (context: FetchInterceptorContext) => {
  const interceptor = createFetchInterceptor(context);
  window.fetch = interceptor;

  return () => {
    if ((window as unknown as Record<string, unknown>)._originalFetch) {
      window.fetch = (window as unknown as Record<string, unknown>)
        ._originalFetch as typeof fetch;
    }
  };
};
