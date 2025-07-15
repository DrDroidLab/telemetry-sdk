import { BasePlugin } from "../BasePlugin";
import type { PageLoadMetricsEvent } from "./types";
import {
  isPerformanceSupported,
  waitForPageLoad,
  captureNavigationTiming,
  captureResourceTiming,
  captureWebVitals,
  setupLongTaskObserver,
  setupLayoutShiftObserver,
} from "./utils";

export class PerformancePlugin extends BasePlugin {
  private hasCapturedInitialMetrics = false;
  private longTaskObserver: PerformanceObserver | null = null;
  private layoutShiftObserver: PerformanceObserver | null = null;

  protected isSupported(): boolean {
    return isPerformanceSupported();
  }

  private capturePerformanceMetrics = () => {
    try {
      if (this.hasCapturedInitialMetrics) {
        return;
      }

      this.hasCapturedInitialMetrics = true;

      // Capture navigation timing
      const navigationMetrics = captureNavigationTiming();

      // Capture resource timing
      const resourceMetrics = captureResourceTiming();
      navigationMetrics.resourceCount = resourceMetrics.length;
      navigationMetrics.resourceLoadTimes = resourceMetrics;

      // Capture web vitals
      const webVitals = captureWebVitals();
      const allMetrics = { ...navigationMetrics, ...webVitals };

      const evt: PageLoadMetricsEvent = {
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

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to capture performance metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("PerformancePlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      // Capture initial page load metrics
      waitForPageLoad(() => {
        this.capturePerformanceMetrics();
      });

      // Monitor for long tasks
      this.longTaskObserver = setupLongTaskObserver({
        safeCapture: this.safeCapture.bind(this),
        logger: this.logger,
      });

      // Monitor for layout shifts
      this.layoutShiftObserver = setupLayoutShiftObserver({
        safeCapture: this.safeCapture.bind(this),
        logger: this.logger,
      });

      this.logger.info("PerformancePlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup PerformancePlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    window.removeEventListener("load", this.capturePerformanceMetrics);

    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }

    if (this.layoutShiftObserver) {
      this.layoutShiftObserver.disconnect();
      this.layoutShiftObserver = null;
    }

    this.logger.info("PerformancePlugin teardown complete");
  }
}
