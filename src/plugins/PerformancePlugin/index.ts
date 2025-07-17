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
  private pageLoadTimeout: NodeJS.Timeout | null = null;

  protected isSupported(): boolean {
    return isPerformanceSupported();
  }

  private capturePerformanceMetrics = () => {
    try {
      if (this.hasCapturedInitialMetrics) {
        return;
      }

      this.hasCapturedInitialMetrics = true;

      // Clear timeout if it was set
      if (this.pageLoadTimeout) {
        clearTimeout(this.pageLoadTimeout);
        this.pageLoadTimeout = null;
      }

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
        eventType: "page",
        eventName: "page_load",
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
      // Capture initial page load metrics with timeout fallback
      waitForPageLoad(() => {
        this.capturePerformanceMetrics();
      });

      // Set a timeout fallback in case page load event doesn't fire
      this.pageLoadTimeout = setTimeout(() => {
        if (!this.hasCapturedInitialMetrics) {
          this.logger.warn(
            "Page load timeout reached, capturing metrics anyway"
          );
          this.capturePerformanceMetrics();
        }
      }, 10000); // 10 second timeout

      // Monitor for long tasks with error handling
      try {
        this.longTaskObserver = setupLongTaskObserver({
          safeCapture: this.safeCapture.bind(this),
          logger: this.logger,
        });

        if (this.longTaskObserver) {
          this.logger.debug("Long task observer setup successful");
        } else {
          this.logger.warn("Long task observer not supported");
        }
      } catch (error) {
        this.logger.error("Failed to setup long task observer", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Monitor for layout shifts with error handling
      try {
        this.layoutShiftObserver = setupLayoutShiftObserver({
          safeCapture: this.safeCapture.bind(this),
          logger: this.logger,
        });

        if (this.layoutShiftObserver) {
          this.logger.debug("Layout shift observer setup successful");
        } else {
          this.logger.warn("Layout shift observer not supported");
        }
      } catch (error) {
        this.logger.error("Failed to setup layout shift observer", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      this.logger.info("PerformancePlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup PerformancePlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      // Clear page load timeout
      if (this.pageLoadTimeout) {
        clearTimeout(this.pageLoadTimeout);
        this.pageLoadTimeout = null;
      }

      // Remove page load event listener
      try {
        window.removeEventListener("load", this.capturePerformanceMetrics);
      } catch (error) {
        this.logger.debug("Failed to remove load event listener", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Disconnect long task observer
      if (this.longTaskObserver) {
        try {
          this.longTaskObserver.disconnect();
          this.logger.debug("Long task observer disconnected");
        } catch (error) {
          this.logger.error("Failed to disconnect long task observer", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        this.longTaskObserver = null;
      }

      // Disconnect layout shift observer
      if (this.layoutShiftObserver) {
        try {
          this.layoutShiftObserver.disconnect();
          this.logger.debug("Layout shift observer disconnected");
        } catch (error) {
          this.logger.error("Failed to disconnect layout shift observer", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        this.layoutShiftObserver = null;
      }

      this.logger.info("PerformancePlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown PerformancePlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
