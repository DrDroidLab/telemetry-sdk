import { BasePlugin } from "./BasePlugin";
import type { TelemetryEvent } from "../types";

export class ClickPlugin extends BasePlugin {
  private handler = (e: MouseEvent) => {
    try {
      const target = e.target;

      // Validate that target is an HTMLElement
      if (!target || !(target instanceof HTMLElement)) {
        this.logger.debug(
          "Click event target is not an HTMLElement, skipping",
          {
            targetType: target ? typeof target : "null",
          }
        );
        return;
      }

      const tgt = target;

      // Safely extract text content with null checks
      let textContent: string | null = null;
      try {
        textContent = tgt.textContent?.trim().slice(0, 50) || null;
      } catch (error) {
        this.logger.debug("Failed to extract text content", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const evt: TelemetryEvent = {
        eventType: "interaction",
        eventName: "click",
        payload: {
          tag: tgt.tagName || "unknown",
          id: tgt.id || null,
          classes: tgt.className || null,
          text: textContent,
          x: e.clientX,
          y: e.clientY,
        },
        timestamp: new Date().toISOString(),
      };

      this.logger.debug("Click event captured", {
        tag: tgt.tagName,
        id: tgt.id,
        coordinates: { x: e.clientX, y: e.clientY },
      });

      this.safeCapture(evt);
    } catch (error) {
      this.logger.error("Failed to process click event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  protected isSupported(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  protected setup(): void {
    if (!this.isSupported()) {
      this.logger.warn("ClickPlugin not supported in this environment");
      this.isEnabled = false;
      return;
    }

    try {
      document.addEventListener("click", this.handler, true);
      this.logger.info("ClickPlugin setup complete");
    } catch (error) {
      this.logger.error("Failed to setup ClickPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isEnabled = false;
    }
  }

  teardown(): void {
    try {
      if (typeof document !== "undefined") {
        document.removeEventListener("click", this.handler, true);
      }
      this.logger.info("ClickPlugin teardown complete");
    } catch (error) {
      this.logger.error("Failed to teardown ClickPlugin", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
