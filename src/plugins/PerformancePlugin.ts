import { BasePlugin } from "./BasePlugin";
import { getLogger } from "../logger";
import type { TelemetryEvent } from "../types";

interface PerformanceMetrics {
  // Navigation Timing API metrics
  navigationStart: number;
  unloadEventStart: number;
  unloadEventEnd: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domLoading: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;

  // Calculated metrics
  dnsTime: number;
  tcpTime: number;
  requestTime: number;
  responseTime: number;
  domParsingTime: number;
  domContentLoadedTime: number;
  loadCompleteTime: number;
  totalPageLoadTime: number;

  // Resource Timing API metrics
  resourceCount: number;
  resourceLoadTimes: Array<{
    name: string;
    duration: number;
    size: number;
    type: string;
  }>;

  // Web Vitals (if available)
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

export class PerformancePlugin extends BasePlugin {
  private logger = getLogger();
  private hasCapturedInitialMetrics = false;

  private captureNavigationTiming(): PerformanceMetrics {
    const navigation = performance.getEntriesByType(
      "navigation",
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
  }

  private captureResourceTiming(): Array<{
    name: string;
    duration: number;
    size: number;
    type: string;
  }> {
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

    return resources.map((resource) => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize || 0,
      type: resource.initiatorType,
    }));
  }

  private async captureWebVitals(): Promise<Partial<PerformanceMetrics>> {
    const vitals: Partial<PerformanceMetrics> = {};

    // Time to First Byte
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    if (navigation) {
      vitals.ttfb = navigation.responseStart - navigation.requestStart;
    }

    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName(
      "first-contentful-paint",
    )[0] as PerformanceEntry;
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
      const fidEntry = fidEntries[0] as any;
      vitals.fid = fidEntry.processingStart - fidEntry.startTime;
    }

    return vitals;
  }

  private capturePerformanceMetrics = async () => {
    try {
      // Wait for page to be fully loaded
      if (document.readyState !== "complete") {
        return;
      }

      // Prevent duplicate captures
      if (this.hasCapturedInitialMetrics) {
        return;
      }

      this.hasCapturedInitialMetrics = true;

      // Capture navigation timing
      const navigationMetrics = this.captureNavigationTiming();

      // Capture resource timing
      const resourceMetrics = this.captureResourceTiming();
      navigationMetrics.resourceCount = resourceMetrics.length;
      navigationMetrics.resourceLoadTimes = resourceMetrics;

      // Capture web vitals
      const webVitals = await this.captureWebVitals();
      const allMetrics = { ...navigationMetrics, ...webVitals };

      const evt: TelemetryEvent = {
        eventType: "performance",
        eventName: "page_load_metrics",
        payload: allMetrics,
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Performance metrics captured", {
        totalPageLoadTime: allMetrics.totalPageLoadTime,
        resourceCount: allMetrics.resourceCount,
        ttfb: allMetrics.ttfb,
      });

      this.manager.capture(evt);
    } catch (error) {
      this.logger.error("Failed to capture performance metrics", error);
    }
  };

  private captureLongTask = (entry: PerformanceEntry) => {
    const evt: TelemetryEvent = {
      eventType: "performance",
      eventName: "long_task",
      payload: {
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.debug("Long task detected", {
      duration: entry.duration,
      name: entry.name,
    });

    this.manager.capture(evt);
  };

  private captureLayoutShift = (entry: PerformanceEntry) => {
    const layoutShiftEntry = entry as any;
    const evt: TelemetryEvent = {
      eventType: "performance",
      eventName: "layout_shift",
      payload: {
        value: layoutShiftEntry.value,
        sources: layoutShiftEntry.sources,
        startTime: layoutShiftEntry.startTime,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.debug("Layout shift detected", {
      value: layoutShiftEntry.value,
    });

    this.manager.capture(evt);
  };

  protected setup(): void {
    // Capture initial page load metrics
    if (document.readyState === "complete") {
      this.capturePerformanceMetrics();
    } else {
      window.addEventListener("load", this.capturePerformanceMetrics);
    }

    // Monitor for long tasks
    if ("PerformanceObserver" in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(this.captureLongTask);
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch (error) {
        this.logger.warn("Long task monitoring not supported", error);
      }

      // Monitor for layout shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(this.captureLayoutShift);
        });
        layoutShiftObserver.observe({ entryTypes: ["layout-shift"] });
      } catch (error) {
        this.logger.warn("Layout shift monitoring not supported", error);
      }
    }

    this.logger.info("PerformancePlugin setup complete");
  }

  teardown(): void {
    window.removeEventListener("load", this.capturePerformanceMetrics);
    this.logger.info("PerformancePlugin teardown complete");
  }
}
