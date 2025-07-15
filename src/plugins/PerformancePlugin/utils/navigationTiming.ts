import type { PerformanceMetrics } from "../types";

export const captureNavigationTiming = (): PerformanceMetrics => {
  const navigation = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming;

  if (!navigation) {
    throw new Error("Navigation Timing API not supported");
  }

  const metrics: PerformanceMetrics = {
    // Navigation Timing API metrics
    navigationStart: navigation.startTime,
    unloadEventStart: navigation.unloadEventStart,
    unloadEventEnd: navigation.unloadEventEnd,
    redirectStart: navigation.redirectStart,
    redirectEnd: navigation.redirectEnd,
    fetchStart: navigation.fetchStart,
    domainLookupStart: navigation.domainLookupStart,
    domainLookupEnd: navigation.domainLookupEnd,
    connectStart: navigation.connectStart,
    connectEnd: navigation.connectEnd,
    secureConnectionStart: navigation.secureConnectionStart,
    requestStart: navigation.requestStart,
    responseStart: navigation.responseStart,
    responseEnd: navigation.responseEnd,
    domLoading: navigation.domContentLoadedEventStart,
    domInteractive: navigation.domInteractive,
    domContentLoadedEventStart: navigation.domContentLoadedEventStart,
    domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
    domComplete: navigation.domComplete,
    loadEventStart: navigation.loadEventStart,
    loadEventEnd: navigation.loadEventEnd,

    // Calculated metrics
    dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcpTime: navigation.connectEnd - navigation.connectStart,
    requestTime: navigation.responseStart - navigation.requestStart,
    responseTime: navigation.responseEnd - navigation.responseStart,
    domParsingTime: navigation.domComplete - navigation.domInteractive,
    domContentLoadedTime:
      navigation.domContentLoadedEventEnd - navigation.startTime,
    loadCompleteTime: navigation.loadEventEnd - navigation.startTime,
    totalPageLoadTime: navigation.loadEventEnd - navigation.startTime,

    // Resource metrics
    resourceCount: 0,
    resourceLoadTimes: [],
  };

  return metrics;
};
