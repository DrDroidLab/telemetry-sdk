import type { TelemetryEvent } from "../../types";
import { HYPERLOOK_URL } from "../../constants";
import { isSupabaseUrl } from "../isSupabaseUrl";
import { extractResponseHeaders } from "./extractResponseHeaders";
import { extractResponseBody } from "./extractResponseBody";
import { extractQueryParams } from "./extractQueryParams";
import { isStreamingResponse } from "../../plugins/NetworkPlugin/utils/streamingDetection";

// Global early event queue for requests made before SDK initialization
export const earlyEventQueue: TelemetryEvent[] = [];
let earlyInterceptorsSetup = false;

// Immediate module-level early interceptor setup
// This ensures interceptors are set up as soon as this module is imported
export const setupModuleLevelEarlyInterceptors = () => {
  if (earlyInterceptorsSetup) {
    return;
  }

  // Set up early fetch interceptor immediately
  const originalFetch =
    typeof window !== "undefined" ? window.fetch : globalThis.fetch;

  const earlyFetchInterceptor = async (
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

      // Determine event type and name
      const isSupabase = isSupabaseUrl(url);
      const eventType = isSupabase ? "supabase" : "network";
      const eventName = isSupabase
        ? "supabase_fetch_complete"
        : "fetch_complete";

      // Queue the request for later processing
      let responseBody: unknown = undefined;
      if (!isStreamingResponse(response)) {
        responseBody = await extractResponseBody(response);
      } else {
        // NOTE: Streaming response: not extracting body to avoid breaking streaming consumers.
      }
      earlyEventQueue.push({
        eventType,
        eventName,
        payload: {
          url,
          method,
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: extractResponseHeaders(response),
          responseBody, // Will be undefined for streaming responses
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: isSupabase,
          queryParams: extractQueryParams(url),
        },
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const endTime = performance.now();

      // Determine event type and name
      const isSupabase = isSupabaseUrl(url);
      const eventType = isSupabase ? "supabase" : "network";
      const eventName = isSupabase ? "supabase_fetch_error" : "fetch_error";

      // Queue the failed request for later processing
      earlyEventQueue.push({
        eventType,
        eventName,
        payload: {
          url,
          method,
          error: error instanceof Error ? error.message : String(error),
          duration: endTime - startTime,
          startTime,
          endTime,
          isSupabaseQuery: isSupabase,
          queryParams: extractQueryParams(url),
        },
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  };

  // Replace fetch immediately
  if (typeof window !== "undefined") {
    (window as unknown as { fetch: typeof fetch }).fetch =
      earlyFetchInterceptor;
  } else {
    (globalThis as { fetch: typeof fetch }).fetch = earlyFetchInterceptor;
  }

  earlyInterceptorsSetup = true;
};
