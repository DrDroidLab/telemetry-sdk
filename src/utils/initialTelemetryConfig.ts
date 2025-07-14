import { LogLevel, TelemetryConfig } from "../types";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.telemetry.com/v1/events",
  enableClicks: true,
  batchSize: 50,
  logging: {
    level: LogLevel.INFO,
  },
};
