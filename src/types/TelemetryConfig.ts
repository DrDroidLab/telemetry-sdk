import { LoggerConfig } from "./Logger";

export type TelemetryConfig = {
  endpoint: string;
  enableClicks?: boolean;
  enableLogs?: boolean;
  batchSize?: number;
  logging?: LoggerConfig;
};
