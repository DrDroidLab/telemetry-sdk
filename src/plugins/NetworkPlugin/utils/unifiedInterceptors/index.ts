// Unified Fetch and XHR Interceptor Utility
// This module provides a unified API for patching/unpatching fetch and XHR for telemetry purposes.
// It supports streaming-safe fetch, flexible event handling, endpoint filtering, and logging.
// If this file grows too large, split implementation into submodules and re-export here.

import type { Logger, TelemetryEvent } from "../../../../types";
import type { NetworkEventPayload } from "../../types/NetworkEvent";

// --- Types ---
// Use TelemetryEvent<NetworkEventPayload> for compatibility with both plugin and early event queue
export type TelemetryHandler = (
  event: TelemetryEvent<NetworkEventPayload>
) => void;
export type EndpointFilter = (url: string) => boolean;

export interface UnifiedInterceptorOptions {
  handleTelemetryEvent: TelemetryHandler;
  shouldCaptureRequest?: EndpointFilter; // Flexible endpoint filtering
  telemetryEndpoint?: string; // For default filtering
  logger?: Logger;
}

// --- Advanced: Expose raw interceptors for testing/advanced use ---
// export function createFetchInterceptor(...) { ... }
// export function createXHRInterceptors(...) { ... }

// If this file exceeds ~100 lines, split into fetch.ts, xhr.ts, types.ts, etc. and re-export here.

// Export unified fetch and XHR patchers
export { patchFetch } from "./fetch";
export { patchXHR } from "./xhr";
