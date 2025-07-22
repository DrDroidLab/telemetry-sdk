import type { TelemetryEvent } from "../../../../types";
import type { Logger } from "../../../../types/Logger";
import type { NetworkEventPayload } from "../../types/NetworkEvent";
import { isStreamingResponse } from "../streamingDetection";
import { extractQueryParams } from "../extractQueryParams";
import { extractResponseHeaders } from "../extractResponseHeaders";
import { extractResponseBody } from "../extractResponseBody";

export interface FetchInterceptorOptions {
  handleTelemetryEvent: (event: TelemetryEvent<NetworkEventPayload>) => void;
  shouldCaptureRequest?: (url: string) => boolean;
  telemetryEndpoint?: string;
  logger?: Logger;
}

export function patchFetch({
  handleTelemetryEvent,
  shouldCaptureRequest,
  telemetryEndpoint,
  logger,
}: FetchInterceptorOptions): () => void {
  if (typeof window === "undefined" || typeof window.fetch === "undefined") {
    throw new Error(
      "patchFetch can only be used in a browser environment with window.fetch available"
    );
  }
  const originalFetch = window.fetch;

  const defaultShouldCapture = (url: string) => {
    // Default: filter out telemetry endpoint and Hyperlook
    if (telemetryEndpoint && url.includes(telemetryEndpoint)) return false;
    if (url.includes("hyperlook")) return false;
    return true;
  };

  const captureCheck = shouldCaptureRequest || defaultShouldCapture;

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

    if (!captureCheck(url)) {
      return originalFetch.call(window, input, init);
    }

    try {
      const response = await originalFetch.call(window, input, init);
      const endTime = performance.now();
      const duration = endTime - startTime;
      let responseBody: unknown = undefined;
      if (!isStreamingResponse(response)) {
        responseBody = await extractResponseBody(response);
      }
      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: url.includes("supabase") ? "supabase" : "network",
        eventName: url.includes("supabase")
          ? "supabase_fetch_complete"
          : "fetch_complete",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          responseStatus: response.status,
          responseStatusText: response.statusText,
          responseHeaders: extractResponseHeaders(response),
          responseBody,
          duration,
          startTime,
          endTime,
          isSupabaseQuery: url.includes("supabase"),
        },
        timestamp: new Date().toISOString(),
      };
      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in fetch", { error: err });
        throw err;
      }
      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const event: TelemetryEvent<NetworkEventPayload> = {
        eventType: url.includes("supabase") ? "supabase" : "network",
        eventName: url.includes("supabase")
          ? "supabase_fetch_error"
          : "fetch_error",
        payload: {
          url,
          method,
          queryParams: extractQueryParams(url),
          error: error instanceof Error ? error.message : String(error),
          duration,
          startTime,
          endTime,
          isSupabaseQuery: url.includes("supabase"),
        },
        timestamp: new Date().toISOString(),
      };
      try {
        handleTelemetryEvent(event);
      } catch (err) {
        logger?.error("Telemetry handler error in fetch (error case)", {
          error: err,
        });
        throw err;
      }
      throw error;
    }
  };

  // Patch fetch
  window.fetch = interceptor as typeof fetch;

  // Return unpatch function
  return () => {
    window.fetch = originalFetch;
  };
}
