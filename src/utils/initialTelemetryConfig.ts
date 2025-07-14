import type { TelemetryConfig } from "../types/TelemetryConfig";

export const initialTelemetryConfig: TelemetryConfig = {
  endpoint: "https://api.example.com/telemetry",
  batchSize: 50,
  enableClicks: true,
};
