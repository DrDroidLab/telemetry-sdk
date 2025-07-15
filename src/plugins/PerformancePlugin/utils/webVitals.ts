import type { PerformanceMetrics } from "../types";

export const captureWebVitals = (): Partial<PerformanceMetrics> => {
  const vitals: Partial<PerformanceMetrics> = {};

  // Time to First Byte
  const navigation = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming;
  if (navigation) {
    vitals.ttfb = navigation.responseStart - navigation.requestStart;
  }

  // First Contentful Paint
  const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0];
  if (fcpEntry) {
    vitals.fcp = fcpEntry.startTime;
  }

  // Largest Contentful Paint
  const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
  if (lcpEntries.length > 0) {
    vitals.lcp = lcpEntries[lcpEntries.length - 1].startTime;
  }

  // First Input Delay (if available)
  const fidEntries = performance.getEntriesByType("first-input");
  if (fidEntries.length > 0) {
    const fidEntry = fidEntries[0] as unknown as Record<string, unknown>;
    vitals.fid =
      (fidEntry.processingStart as number) - (fidEntry.startTime as number);
  }

  return vitals;
};
