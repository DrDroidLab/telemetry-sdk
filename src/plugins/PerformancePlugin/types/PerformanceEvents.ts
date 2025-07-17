import type { PerformanceMetrics } from "./PerformanceMetrics";

export type LongTaskEvent = {
  eventType: "performance";
  eventName: "long_task";
  payload: {
    duration: number;
    startTime: number;
    name: string;
  };
  timestamp: string;
};

export type LayoutShiftEvent = {
  eventType: "performance";
  eventName: "layout_shift";
  payload: {
    value: number;
    sources: unknown[];
    startTime: number;
  };
  timestamp: string;
};

export type PageLoadMetricsEvent = {
  eventType: "page";
  eventName: "page_load";
  payload: PerformanceMetrics;
  timestamp: string;
};
