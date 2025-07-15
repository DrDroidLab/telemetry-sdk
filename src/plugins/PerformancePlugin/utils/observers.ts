import type { LongTaskEvent, LayoutShiftEvent } from "../types";

export type ObserverContext = {
  safeCapture: (event: LongTaskEvent | LayoutShiftEvent) => void;
  logger: {
    warn: (message: string, meta?: Record<string, unknown>) => void;
  };
};

export const setupLongTaskObserver = (context: ObserverContext) => {
  const { safeCapture, logger } = context;

  if (!("PerformanceObserver" in window)) {
    return null;
  }

  try {
    const longTaskObserver = new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        try {
          const evt: LongTaskEvent = {
            eventType: "performance",
            eventName: "long_task",
            payload: {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            },
            timestamp: new Date().toISOString(),
          };

          safeCapture(evt);
        } catch (error) {
          logger.warn("Failed to capture long task", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    });

    longTaskObserver.observe({ entryTypes: ["longtask"] });
    return longTaskObserver;
  } catch (error) {
    logger.warn("Long task monitoring not supported", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const setupLayoutShiftObserver = (context: ObserverContext) => {
  const { safeCapture, logger } = context;

  if (!("PerformanceObserver" in window)) {
    return null;
  }

  try {
    const layoutShiftObserver = new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        try {
          const layoutShiftEntry = entry as unknown as Record<string, unknown>;
          const evt: LayoutShiftEvent = {
            eventType: "performance",
            eventName: "layout_shift",
            payload: {
              value: layoutShiftEntry.value as number,
              sources: layoutShiftEntry.sources as unknown[],
              startTime: layoutShiftEntry.startTime as number,
            },
            timestamp: new Date().toISOString(),
          };

          safeCapture(evt);
        } catch (error) {
          logger.warn("Failed to capture layout shift", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    });

    layoutShiftObserver.observe({ entryTypes: ["layout-shift"] });
    return layoutShiftObserver;
  } catch (error) {
    logger.warn("Layout shift monitoring not supported", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
