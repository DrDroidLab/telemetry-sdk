import type { TelemetryExporter, TelemetryEvent } from "../types";
import { getLogger } from "../logger";

export class HTTPExporter implements TelemetryExporter {
  private logger = getLogger();

  constructor() {
    this.logger.debug("HttpExporter initialized");
  }

  async export(events: TelemetryEvent[], endpoint?: string): Promise<void> {
    if (!endpoint || endpoint.trim() === "") {
      this.logger.warn("HTTP export skipped - no endpoint configured", {
        eventCount: events.length,
      });
      return;
    }

    this.logger.debug("Exporting events via HTTP", {
      endpoint,
      eventCount: events.length,
    });

    try {
      // Add timeout protection for network requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.logger.debug("HTTP export successful", {
          status: response.status,
          eventCount: events.length,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.logger.error("HTTP export failed", {
          endpoint,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          eventCount: events.length,
        });
        throw error;
      }
    } catch (error) {
      this.logger.error("HTTP export failed", {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        eventCount: events.length,
      });
      throw error;
    }
  }
}
