export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  SILENT = 4,
}

export interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableTimestamp?: boolean;
  prefix?: string;
  formatter?: (
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ) => string;
}

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
  setConfig(config: Partial<LoggerConfig>): void;
}
