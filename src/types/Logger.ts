import { Logger as WinstonLogger } from "winston";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  SILENT = "silent",
}

export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableTimestamp?: boolean;
  prefix?: string;
  format?: "json" | "simple" | "custom";
  customFormat?: (info: any) => string;
}

// Re-export Winston's Logger type for convenience
export type Logger = WinstonLogger;
