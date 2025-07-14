import { TelemetryEvent } from "./TelemetryEvent";

export type TelemetryExporter = {
  export(events: TelemetryEvent[]): Promise<void>;
};
