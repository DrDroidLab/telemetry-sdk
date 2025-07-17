import type { TelemetryExporter, TelemetryEvent } from "../../types";
import { getLogger } from "../../logger";
import { HYPERLOOK_URL } from "../../constants";
import { transformEvent } from "./utils";

export class HyperlookExporter implements TelemetryExporter {
  private logger = getLogger();
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger.debug("HyperlookExporter initialized", {
      endpoint: HYPERLOOK_URL,
    });
  }

  async export(events: TelemetryEvent[], _endpoint?: string): Promise<void> {
    if (!events.length) {
      this.logger.debug("No events to export to Hyperlook");
      return;
    }

    this.logger.debug("Exporting events to Hyperlook", {
      endpoint: HYPERLOOK_URL,
      eventCount: events.length,
    });

    try {
      // Transform events to Hyperlook format
      const hyperlookEvents = events.map(event => transformEvent(event));

      const payload = {
        events: hyperlookEvents,
      };

      this.logger.debug("Sending payload to Hyperlook", {
        payload: JSON.stringify(payload, null, 2),
      });

      // Add timeout protection for network requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(HYPERLOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-API-Key": this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        this.logger.debug("Hyperlook export successful", {
          status: response.status,
          eventCount: events.length,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.logger.error("Hyperlook export failed", {
          endpoint: HYPERLOOK_URL,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          eventCount: events.length,
        });
        throw error;
      }
    } catch (error) {
      this.logger.error("Hyperlook export failed", {
        endpoint: HYPERLOOK_URL,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        eventCount: events.length,
      });
      throw error;
    }
  }
}

// Export types and utils
export * from "./types";
export * from "./utils";
