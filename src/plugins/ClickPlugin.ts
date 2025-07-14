import { BasePlugin } from "./BasePlugin";
import { getLogger } from "../logger";
import type { TelemetryEvent } from "../types";

export class ClickPlugin extends BasePlugin {
  private logger = getLogger();

  private handler = (e: MouseEvent) => {
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
      meta: {
        tag: tgt.tagName,
        id: tgt.id,
        coordinates: { x: e.clientX, y: e.clientY },
      },
    });

    this.manager.capture(evt);
  };

  protected setup(): void {
    document.addEventListener("click", this.handler, true);
    this.logger.info("ClickPlugin setup complete");
  }

  teardown(): void {
    document.removeEventListener("click", this.handler, true);
    this.logger.info("ClickPlugin teardown complete");
  }
}
