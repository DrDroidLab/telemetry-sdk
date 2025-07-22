import type { NetworkEvent } from "../types";
import type { Logger } from "../../../types/Logger";
import {
  extractQueryParams,
  extractResponseHeaders,
  extractResponseBody,
} from "./index";
import { isSupabaseUrl } from "../../../utils";
import { HYPERLOOK_URL } from "../../../constants";
import { isStreamingResponse } from "./streamingDetection";

export type FetchInterceptorContext = {
  originalFetch: typeof fetch;
  telemetryEndpoint: string;
  safeCapture: (event: NetworkEvent) => void;
  logger?: Logger;
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

    // Filter out requests to the Hyperlook ingestion URL
    if (url.includes(HYPERLOOK_URL)) {
      return originalFetch.call(
        typeof window !== "undefined" ? window : globalThis,
        input,
        init
      );
    }

    try {
      const response = await originalFetch.call(
        typeof window !== "undefined" ? window : globalThis,
        input,
        init
      );
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!telemetryEndpoint || !url.includes(telemetryEndpoint)) {
        const isSupabaseQuery = isSupabaseUrl(url);
        const eventName = isSupabaseQuery
          ? "supabase_fetch_complete"
          : "fetch_complete";
        const eventType = isSupabaseQuery ? "supabase" : "network";

        // Streaming-safe body extraction
        let responseBody: unknown = undefined;
        if (!isStreamingResponse(response)) {
          responseBody = await extractResponseBody(response);
        } else {
          // NOTE: To capture the body after a streaming response is fully consumed,
          // you would need to intercept and buffer the stream as it is read by the application.
          // This is complex, can impact performance, and may break consumer expectations.
          // If needed, implement a ReadableStream tee() here and buffer chunks, then
          // reconstruct the body after the stream ends. This is not recommended for most telemetry use cases.
        }

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
            responseBody, // Will be undefined for streaming responses
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
        const isSupabaseQuery = isSupabaseUrl(url);
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
  const originalFetch =
    typeof window !== "undefined" ? window.fetch : globalThis.fetch;

  // Replace fetch with interceptor
  if (typeof window !== "undefined") {
    window.fetch = interceptor;
  } else {
    // In Node.js, we need to patch the global fetch
    (globalThis as { fetch: typeof fetch }).fetch = interceptor;
  }

  // Return function to restore original fetch
  return () => {
    if (typeof window !== "undefined") {
      window.fetch = originalFetch;
    } else {
      (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
    }
  };
};
