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
      // Removed unused textContent extraction and try-catch block

      const rect = tgt.getBoundingClientRect();

      const evt: TelemetryEvent = {
        eventType: "interaction",
        eventName: "click",
        payload: {
          element: {
            tagName: tgt.tagName,
            id: tgt.id || null,
            className: tgt.className || null,
            textContent: tgt.textContent?.slice(0, 100) || null,
            href: (tgt as HTMLAnchorElement).href || null,
            type: (tgt as HTMLInputElement).type || null,
            value: (tgt as HTMLInputElement).value || null,
            placeholder: (tgt as HTMLInputElement).placeholder || null,
            role: tgt.getAttribute("role") || null,
            ariaLabel: tgt.getAttribute("aria-label") || null,
            dataAttributes: Object.fromEntries(
              Array.from(tgt.attributes)
                .filter(attr => attr.name.startsWith("data-"))
                .map(attr => [attr.name, attr.value])
            ),
          },
          position: {
            x: e.clientX,
            y: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
            screenX: e.screenX,
            screenY: e.screenY,
          },
          boundingRect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
          event: {
            button: e.button,
            buttons: e.buttons,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            type: e.type,
            timestamp: e.timeStamp,
          },
          scrollX: window.scrollX,
          scrollY: window.scrollY,
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

  public isSupported(): boolean {
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
