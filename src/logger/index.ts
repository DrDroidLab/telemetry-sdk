import { createWinstonLogger } from "./WinstonLogger";
import { LoggerConfig, Logger } from "../types";

// Global logger instance
let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createWinstonLogger();
  }
  return globalLogger;
}

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

export function createLogger(config?: LoggerConfig): Logger {
  return createWinstonLogger(config);
}
