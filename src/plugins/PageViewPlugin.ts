/* eslint-disable @typescript-eslint/unbound-method */
import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class PageViewPlugin extends BasePlugin {
  private hasCapturedInitialPageView = false;
  private lastUrl: string | null = null;
  private lastTitle: string | null = null;
  private popstateListener: (() => void) | null = null;
  private navigationTimeout: ReturnType<typeof setTimeout> | null = null;
  private originalPushState: typeof window.history.pushState | null = null;
  private originalReplaceState: typeof window.history.replaceState | null =
    null;
  private domContentLoadedListener: () => void;
  private loadListener: () => void;
  private navigationListener: (() => void) | null = null;

  constructor() {
    super();
    this.domContentLoadedListener = () => {
      // Inline logic of capturePageView(false)
      try {
        if (typeof window === "undefined" || typeof document === "undefined") {
          return;
        }
        const currentUrl = window.location.href;
        const currentTitle = document.title;
        if (this.hasCapturedInitialPageView) {
          return;
        }
        this.hasCapturedInitialPageView = true;
        this.lastUrl = currentUrl;
        this.lastTitle = currentTitle;
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
            title: currentTitle,
            isNavigation: false,
          },
          timestamp: new Date().toISOString(),
        };
        this.logger.debug("Page view event captured", {
          url: currentUrl,
          title: currentTitle,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          isNavigation: false,
        });
        this.safeCapture(evt);
      } catch (error) {
        this.logger.error("Failed to capture page view event", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    this.loadListener = () => {
      if (!this.hasCapturedInitialPageView) {
        // Inline logic of capturePageView(false)
        try {
          if (
            typeof window === "undefined" ||
            typeof document === "undefined"
          ) {
            return;
          }
          const currentUrl = window.location.href;
          const currentTitle = document.title;
          this.hasCapturedInitialPageView = true;
          this.lastUrl = currentUrl;
          this.lastTitle = currentTitle;
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
              title: currentTitle,
              isNavigation: false,
            },
            timestamp: new Date().toISOString(),
          };
          this.logger.debug("Page view event captured", {
            url: currentUrl,
            title: currentTitle,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            isNavigation: false,
          });
          this.safeCapture(evt);
        } catch (error) {
          this.logger.error("Failed to capture page view event", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
  }

  protected isSupported(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  private capturePageView = (isNavigation = false) => {
    try {
      // Double-check we're still in a browser environment
      if (typeof window === "undefined" || typeof document === "undefined") {
        return;
      }

      const currentUrl = window.location.href;
      const currentTitle = document.title;

      // For initial page load, only capture once
      if (!isNavigation && this.hasCapturedInitialPageView) {
        return;
      }

      // For navigation, only capture if URL or title has changed
      if (
        isNavigation &&
        this.lastUrl === currentUrl &&
        this.lastTitle === currentTitle
      ) {
        return;
      }

      // Update tracking state
      if (!isNavigation) {
        this.hasCapturedInitialPageView = true;
      }
      this.lastUrl = currentUrl;
      this.lastTitle = currentTitle;

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
          title: currentTitle,
          isNavigation: isNavigation,
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Page view event captured", {
        url: currentUrl,
        title: currentTitle,
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
    // Clear any existing timeout
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }

    // Use a small delay to ensure the URL and title have been updated
    this.navigationTimeout = setTimeout(() => {
      this.capturePageView(true);
      this.navigationTimeout = null;
    }, 100);
  };

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("PageViewPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      // Initialize tracking variables early
      this.lastUrl = window.location.href;
      this.lastTitle = document.title;

      // Capture page view immediately if document is already loaded
      if (document.readyState === "complete") {
        this.captureInitialPageView();
      } else {
        // Wait for DOM content loaded to capture page view
        document.addEventListener(
          "DOMContentLoaded",
          this.domContentLoadedListener
        );
        // Fallback: capture on window load if DOMContentLoaded doesn't fire
        window.addEventListener("load", this.loadListener);
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
      // Listen for popstate events (back/forward navigation)
      this.popstateListener = () => {
        this.handleNavigation();
      };
      window.addEventListener("popstate", this.popstateListener);

      // Use a safe History API override that doesn't cause infinite loops
      this.setupHistoryTracking();

      this.logger.debug("Navigation tracking setup complete");
    } catch (error) {
      this.logger.error("Failed to setup navigation tracking", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setupHistoryTracking(): void {
    try {
      // Store original methods
      this.originalPushState = window.history.pushState;
      this.originalReplaceState = window.history.replaceState;

      // Create safe overrides that don't dispatch popstate events
      // This prevents the infinite loop that was causing the original issue
      window.history.pushState = (...args) => {
        // Call the original method first
        if (!this.originalPushState) return;
        const result = this.originalPushState.apply(window.history, args);

        // Use a custom event instead of popstate to avoid infinite loops
        window.dispatchEvent(
          new CustomEvent("telemetry-navigation", {
            detail: { type: "pushstate", args },
          })
        );

        return result;
      };

      window.history.replaceState = (...args) => {
        // Call the original method first
        if (!this.originalReplaceState) return;
        const result = this.originalReplaceState.apply(window.history, args);

        // Use a custom event instead of popstate to avoid infinite loops
        window.dispatchEvent(
          new CustomEvent("telemetry-navigation", {
            detail: { type: "replacestate", args },
          })
        );

        return result;
      };

      // Listen for our custom navigation events
      const navigationListener = () => {
        this.handleNavigation();
      };
      window.addEventListener("telemetry-navigation", navigationListener);

      // Store the listener for cleanup
      this.navigationListener = navigationListener;

      this.logger.debug("History tracking setup complete");
    } catch (error) {
      this.logger.error("Failed to setup history tracking", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  teardown(): void {
    try {
      // Clear navigation timeout
      if (this.navigationTimeout) {
        clearTimeout(this.navigationTimeout);
        this.navigationTimeout = null;
      }

      // Remove DOM content loaded listener
      document.removeEventListener(
        "DOMContentLoaded",
        this.domContentLoadedListener
      );
      // Remove load listener
      window.removeEventListener("load", this.loadListener);

      // Remove navigation tracking
      if (this.popstateListener) {
        window.removeEventListener("popstate", this.popstateListener);
        this.popstateListener = null;
      }

      // Remove custom navigation listener
      if (this.navigationListener) {
        window.removeEventListener(
          "telemetry-navigation",
          this.navigationListener
        );
        this.navigationListener = null;
      }

      // Restore original History API methods
      if (this.originalPushState) {
        window.history.pushState = this.originalPushState;
        this.originalPushState = null;
      }
      if (this.originalReplaceState) {
        window.history.replaceState = this.originalReplaceState;
        this.originalReplaceState = null;
      }

      this.logger.info("PageViewPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown PageViewPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
