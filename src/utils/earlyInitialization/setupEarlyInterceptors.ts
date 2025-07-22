import type { TelemetryEvent } from "../../types";
// Imports for early event queue and unified interceptors
import {
  patchFetch,
  patchXHR,
} from "../../plugins/NetworkPlugin/utils/unifiedInterceptors";

// Global early event queue for requests made before SDK initialization
export const earlyEventQueue: TelemetryEvent[] = [];
let earlyInterceptorsSetup = false;

// Immediate module-level early interceptor setup
// This ensures interceptors are set up as soon as this module is imported
export const setupModuleLevelEarlyInterceptors = () => {
  if (earlyInterceptorsSetup) {
    return;
  }

  if (typeof window !== "undefined" && typeof window.fetch !== "undefined") {
    // Patch fetch and XHR using unified interceptors
    patchFetch({
      handleTelemetryEvent: event => earlyEventQueue.push(event),
    });
    if (typeof XMLHttpRequest !== "undefined") {
      patchXHR({
        handleTelemetryEvent: event => earlyEventQueue.push(event),
      });
    }
  }

  earlyInterceptorsSetup = true;
};
