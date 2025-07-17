import type { TelemetryEvent } from "./TelemetryEvent";

export type TelemetryExporter = {
  export(events: TelemetryEvent[], endpoint?: string): Promise<void>;
};
