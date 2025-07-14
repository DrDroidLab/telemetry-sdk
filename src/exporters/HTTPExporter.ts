import { TelemetryExporter, TelemetryEvent } from "../types";
import { getLogger } from "../logger";

export class HttpExporter implements TelemetryExporter {
  private logger = getLogger();

  constructor(private endpoint: string) {
    this.logger.debug("HttpExporter initialized", { meta: { endpoint } });
  }

  async export(events: TelemetryEvent[]): Promise<void> {
    this.logger.debug("Exporting events via HTTP", {
      meta: {
        endpoint: this.endpoint,
        eventCount: events.length,
      },
    });

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.debug("HTTP export successful", {
        meta: {
          status: response.status,
          eventCount: events.length,
        },
      });
    } catch (error) {
      this.logger.error("HTTP export failed", {
        meta: {
          endpoint: this.endpoint,
          error: error instanceof Error ? error.message : String(error),
          eventCount: events.length,
        },
      });
      throw error;
    }
  }
}
