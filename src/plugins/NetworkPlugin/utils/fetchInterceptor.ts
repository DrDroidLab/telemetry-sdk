import type { NetworkEvent } from "../types";

export type FetchInterceptorContext = {
  originalFetch: typeof fetch;
  telemetryEndpoint: string;
  safeCapture: (event: NetworkEvent) => void;
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
const extractResponseHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};
  try {
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
  } catch {
    // Ignore header extraction errors
  }
  return headers;
};

// Helper function to extract response body
const extractResponseBody = async (response: Response): Promise<unknown> => {
  try {
    const clone = response.clone(); // Clone to avoid consuming the response
    const text = await clone.text();
    if (text) {
      return JSON.parse(text);
    }
  } catch {
    // If JSON parsing fails, return the raw text
    try {
      const clone = response.clone();
      return await clone.text();
    } catch {
      return null;
    }
  }
  return null;
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
            queryParams: extractQueryParams(url),
            responseStatus: response.status,
            responseStatusText: response.statusText,
            responseHeaders: extractResponseHeaders(response),
            responseBody: await extractResponseBody(response),
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
            queryParams: extractQueryParams(url),
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

  // Store original fetch
  const originalFetch = window.fetch;

  // Replace fetch with interceptor
  window.fetch = interceptor;

  // Return function to restore original fetch
  return () => {
    window.fetch = originalFetch;
  };
};
