import type { TelemetryEvent } from "./TelemetryEvent";

export type TelemetryExporter = {
  export(events: TelemetryEvent[], endpoint?: string): Promise<void>;
  /**
   * Optionally resolve an endpoint for this exporter.
   */
  getEndpoint?(endpoint?: string): string | undefined;
  /**
   * Optionally transform events into a transport payload.
   * If forBeacon is true, the exporter can tailor the payload for sendBeacon.
   */
  transformPayload?(events: TelemetryEvent[], forBeacon?: boolean): unknown;
};
