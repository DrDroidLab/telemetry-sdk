import { LoggerConfig } from "./Logger";

export type TelemetryConfig = {
  endpoint: string;
  enableClicks?: boolean;
  batchSize?: number;
  logging?: LoggerConfig;
};
