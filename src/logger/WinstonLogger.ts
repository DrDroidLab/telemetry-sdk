import winston from "winston";
import { LogLevel, LoggerConfig, Logger } from "../types/Logger";

export function createWinstonLogger(config: LoggerConfig = {}): Logger {
  const {
    level = LogLevel.INFO,
    enableConsole = true,
    enableTimestamp = true,
    prefix = "[TelemetrySDK]",
    format = "simple",
    customFormat,
  } = config;

  // If level is SILENT, return a no-op logger
  if (level === LogLevel.SILENT) {
    return winston.createLogger({
      silent: true,
      transports: [],
    });
  }

  const transports: winston.transport[] = [];

  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        level,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf((info) => {
            const timestamp = enableTimestamp ? `[${info.timestamp}]` : "";
            const levelStr = `[${info.level.toUpperCase()}]`;
            const message = info.message;
            const meta = info.meta ? ` ${JSON.stringify(info.meta)}` : "";

            if (customFormat) {
              return customFormat(info);
            }

            return `${timestamp}${prefix}${levelStr} ${message}${meta}`;
          }),
        ),
      }),
    );
  }

  return winston.createLogger({
    level,
    transports,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
    ),
  });
}
