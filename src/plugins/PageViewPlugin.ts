import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class PageViewPlugin extends BasePlugin {
  private hasCapturedInitialPageView = false;

  protected isSupported(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  private capturePageView = () => {
    try {
      if (this.hasCapturedInitialPageView) {
        return;
      }

      this.hasCapturedInitialPageView = true;

      // Use window.navigator for clarity and compatibility
      const nav =
        typeof window !== "undefined" && window.navigator
          ? window.navigator
          : undefined;

      const evt: TelemetryEvent = {
        eventType: "page",
        eventName: "page_hit",
        payload: {
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
          characterSet: document.characterSet,
          language: nav ? nav.language : "",
          cookieEnabled: nav ? nav.cookieEnabled : false,
          onLine: nav ? nav.onLine : false,
          platform: nav ? nav.platform : "",
          userAgent: nav ? nav.userAgent : "",
          referrer: document.referrer,
          url: window.location.href,
          title: document.title,
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Page view event captured", {
        url: window.location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to capture page view event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("PageViewPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      // Capture page view immediately if document is already loaded
      if (document.readyState === "complete") {
        this.capturePageView();
      } else {
        // Wait for DOM content loaded to capture page view
        document.addEventListener("DOMContentLoaded", () => {
          this.capturePageView();
        });

        // Fallback: capture on window load if DOMContentLoaded doesn't fire
        window.addEventListener("load", () => {
          if (!this.hasCapturedInitialPageView) {
            this.capturePageView();
          }
        });
      }

      this.logger.info("PageViewPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup PageViewPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      // Remove event listeners
      document.removeEventListener("DOMContentLoaded", this.capturePageView);
      window.removeEventListener("load", this.capturePageView);

      this.logger.info("PageViewPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown PageViewPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
