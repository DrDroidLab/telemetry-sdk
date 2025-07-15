import { SimpleLogger } from "./SimpleLogger";
import type { LoggerConfig, Logger } from "../types/Logger";

export { LogLevel } from "../types/Logger";
export type { LoggerConfig, Logger } from "../types/Logger";

// Global logger instance
let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new SimpleLogger();
  }
  return globalLogger;
}

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

export function createLogger(config?: LoggerConfig): Logger {
  return new SimpleLogger(config);
}
