import type { TelemetryEvent } from "../../types";
// Imports for early event queue and unified interceptors
import {
  patchFetch,
  patchXHR,
} from "../../plugins/NetworkPlugin/utils/unifiedInterceptors";
import { getCurrentVersion } from "../../utils/versionUtils";

// Global early event queue for requests made before SDK initialization
export const earlyEventQueue: TelemetryEvent[] = [];
let earlyInterceptorsSetup = false;

// Capture version at module load time to ensure consistency
const EARLY_SDK_VERSION = getCurrentVersion();

// Immediate module-level early interceptor setup
// This ensures interceptors are set up as soon as this module is imported
export const setupModuleLevelEarlyInterceptors = () => {
  if (earlyInterceptorsSetup) {
    return;
  }

  if (typeof window !== "undefined" && typeof window.fetch !== "undefined") {
    // Patch fetch and XHR using unified interceptors
    patchFetch({
      handleTelemetryEvent: event => {
        // Add version info to early events immediately
        const eventWithVersion: TelemetryEvent = {
          ...event,
          sdkMetadata: {
            version: EARLY_SDK_VERSION,
          },
        };
        earlyEventQueue.push(eventWithVersion);
      },
    });
    if (typeof XMLHttpRequest !== "undefined") {
      patchXHR({
        handleTelemetryEvent: event => {
          // Add version info to early events immediately
          const eventWithVersion: TelemetryEvent = {
            ...event,
            sdkMetadata: {
              version: EARLY_SDK_VERSION,
            },
          };
          earlyEventQueue.push(eventWithVersion);
        },
      });
    }
  }

  earlyInterceptorsSetup = true;
};
