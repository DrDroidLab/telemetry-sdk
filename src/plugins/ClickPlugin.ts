import { BasePlugin } from "./BasePlugin";
import { getLogger } from "../logger";
import type { TelemetryEvent } from "../types";

export class ClickPlugin extends BasePlugin {
  private handler = (e: MouseEvent) => {
    try {
      const tgt = e.target as HTMLElement;
      const evt: TelemetryEvent = {
        eventType: "interaction",
        eventName: "click",
        payload: {
          tag: tgt.tagName,
          id: tgt.id || null,
          classes: tgt.className || null,
          text: tgt.textContent?.trim().slice(0, 50) || null,
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
    document.removeEventListener("click", this.handler, true);
    this.logger.info("ClickPlugin teardown complete");
  }
}
