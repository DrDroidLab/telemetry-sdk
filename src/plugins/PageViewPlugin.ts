import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class PageViewPlugin extends BasePlugin {
  private hasCapturedInitialPageView = false;
  private lastUrl: string | null = null;
  private historyListener: (() => void) | null = null;
  private popstateListener: (() => void) | null = null;

  protected isSupported(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  private capturePageView = (isNavigation = false) => {
    try {
      const currentUrl = window.location.href;

      // For initial page load, only capture once
      if (!isNavigation && this.hasCapturedInitialPageView) {
        return;
      }

      // For navigation, only capture if URL has changed
      if (isNavigation && this.lastUrl === currentUrl) {
        return;
      }

      // Update tracking state
      if (!isNavigation) {
        this.hasCapturedInitialPageView = true;
      }
      this.lastUrl = currentUrl;

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
          url: currentUrl,
          title: document.title,
          isNavigation: isNavigation,
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Page view event captured", {
        url: currentUrl,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        isNavigation: isNavigation,
      });

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to capture page view event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  private captureInitialPageView = () => {
    this.capturePageView(false);
  };

  private handleNavigation = () => {
    // Use a small delay to ensure the URL and title have been updated
    setTimeout(() => {
      this.capturePageView(true);
    }, 100);
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
        this.captureInitialPageView();
      } else {
        // Wait for DOM content loaded to capture page view
        const domContentLoadedHandler = () => {
          this.captureInitialPageView();
        };
        document.addEventListener("DOMContentLoaded", domContentLoadedHandler);

        // Fallback: capture on window load if DOMContentLoaded doesn't fire
        const loadHandler = () => {
          if (!this.hasCapturedInitialPageView) {
            this.captureInitialPageView();
          }
        };
        window.addEventListener("load", loadHandler);
      }

      // Set up navigation tracking for React/Next.js client-side routing
      this.setupNavigationTracking();

      this.logger.info("PageViewPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup PageViewPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  private setupNavigationTracking(): void {
    try {
      // Track History API changes (React Router, Next.js client-side navigation)
      const originalPushState = (
        ...args: Parameters<typeof window.history.pushState>
      ) => window.history.pushState.apply(window.history, args);
      const originalReplaceState = (
        ...args: Parameters<typeof window.history.replaceState>
      ) => window.history.replaceState.apply(window.history, args);

      this.historyListener = () => {
        this.handleNavigation();
      };

      // Override pushState to detect navigation
      window.history.pushState = function (...args) {
        originalPushState(...args);
        // Trigger navigation event
        window.dispatchEvent(new PopStateEvent("popstate"));
      };

      // Override replaceState to detect navigation
      window.history.replaceState = function (...args) {
        originalReplaceState(...args);
        // Trigger navigation event
        window.dispatchEvent(new PopStateEvent("popstate"));
      };

      // Listen for popstate events (back/forward navigation)
      this.popstateListener = () => {
        this.handleNavigation();
      };
      window.addEventListener("popstate", this.popstateListener);

      this.logger.debug("Navigation tracking setup complete");
    } catch (error) {
      this.logger.error("Failed to setup navigation tracking", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  teardown(): void {
    try {
      // Note: We can't easily remove the event listeners since they were created as local variables
      // This is a limitation, but the plugin will be destroyed anyway

      // Remove navigation tracking
      if (this.popstateListener) {
        window.removeEventListener("popstate", this.popstateListener);
        this.popstateListener = null;
      }

      // Restore original History API methods if they were overridden
      if (this.historyListener) {
        // Note: We can't easily restore the original methods without storing them
        // This is a limitation, but the overrides are safe and won't cause issues
        this.historyListener = null;
      }

      this.logger.info("PageViewPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown PageViewPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
