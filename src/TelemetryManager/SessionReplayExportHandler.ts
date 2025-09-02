import type { TelemetryEvent, Logger } from "../types";
import { generateEventId } from "./utils";

export class SessionReplayExportHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handle session replay events with special batching logic
   */
  async handleSessionReplayExports(
    sessionReplayEvents: TelemetryEvent[],
    flushWithBeacon: (events: TelemetryEvent[]) => {
      success: boolean;
      shouldReturnToBuffer: boolean;
    },
    flushBatch: (
      events: TelemetryEvent[],
      retries: number,
      startTime: number
    ) => Promise<{ success: boolean; shouldReturnToBuffer: boolean }>,
    useBeacon: boolean = false
  ): Promise<{
    success: boolean;
    shouldReturnToBuffer: boolean;
    failedEvents: TelemetryEvent[];
  }> {
    if (sessionReplayEvents.length === 0) {
      return { success: true, shouldReturnToBuffer: false, failedEvents: [] };
    }

    const startTime = Date.now();
    const batchedEvents = this.batchSessionReplayEvents(sessionReplayEvents);

    let allBatchesSuccessful = true;
    const failedEvents: TelemetryEvent[] = [];

    for (const batch of batchedEvents) {
      // Assign event IDs to events that don't have them
      const eventsWithIds: TelemetryEvent[] = batch.map(event => ({
        ...event,
        event_id: event.event_id || generateEventId(),
      }));

      let result;
      if (useBeacon) {
        result = flushWithBeacon(eventsWithIds);
      } else {
        result = await flushBatch(eventsWithIds, 0, startTime);
      }

      if (!result.success && result.shouldReturnToBuffer) {
        failedEvents.push(...batch);
        allBatchesSuccessful = false;
      }
    }

    return {
      success: allBatchesSuccessful,
      shouldReturnToBuffer: failedEvents.length > 0,
      failedEvents,
    };
  }

  private batchSessionReplayEvents(
    events: TelemetryEvent[]
  ): TelemetryEvent[][] {
    const batches: TelemetryEvent[][] = [];
    let currentBatch: TelemetryEvent[] = [];

    for (const event of events) {
      const hasLargeRrwebEvents = this.hasLargeRrwebEvents(event);

      if (hasLargeRrwebEvents) {
        // If current batch has events, save it first
        if (currentBatch.length > 0) {
          batches.push([...currentBatch]);
          currentBatch = [];
        }

        // Send this large session replay event individually
        batches.push([event]);
        continue;
      }

      // For smaller events, batch them together (max 5 events per batch)
      if (currentBatch.length >= 5) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }

      currentBatch.push(event);
    }

    // Add the final batch if it has events
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private hasLargeRrwebEvents(event: TelemetryEvent): boolean {
    try {
      const payload = event.payload;
      if (payload && typeof payload === "object") {
        const events = payload.events;
        if (Array.isArray(events)) {
          // Check if any rrweb event is a large type
          return events.some(rrwebEvent => {
            if (
              rrwebEvent &&
              typeof rrwebEvent === "object" &&
              "type" in rrwebEvent
            ) {
              const eventWithType = rrwebEvent as { type: unknown };
              const eventType = Number(eventWithType.type);
              // Type 2 = FullSnapshot (DOM snapshot) - these are large
              // Type 4 = Custom events - can be large
              // Type 5 = Plugin events - can be large
              return eventType === 2 || eventType === 4 || eventType === 5;
            }
            return false;
          });
        }
      }
      return false;
    } catch (error) {
      this.logger.debug("Error checking rrweb event types, assuming small", {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.eventType,
      });
      return false;
    }
  }
}
