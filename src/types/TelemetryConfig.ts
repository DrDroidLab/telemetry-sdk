import type { LoggerConfig } from "./Logger";

export type TelemetryConfig = {
  endpoint: string;
  enableClicks?: boolean;
  enableLogs?: boolean;
  enableNetwork?: boolean;
  enablePerformance?: boolean;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  samplingRate?: number;
  logging?: LoggerConfig;
  sessionId?: string;
  userId?: string;
  enableCustomEvents?: boolean;
};
