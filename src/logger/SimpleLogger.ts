import { TELEMETRY_SDK_PREFIX } from "../constants";
import { LogLevel, type LoggerConfig, type Logger } from "../types/Logger";

export class SimpleLogger implements Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableTimestamp: true,
      prefix: TELEMETRY_SDK_PREFIX,
      ...config,
    };
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    if (
      !this.config.enableConsole ||
      level < (this.config.level ?? LogLevel.INFO)
    ) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): string {
    if (this.config.formatter) {
      return this.config.formatter(level, message, meta);
    }

    const timestamp = this.config.enableTimestamp
      ? `[${new Date().toISOString()}]`
      : "";
    const levelStr = `[${LogLevel[level]}]`;
    const prefix = this.config.prefix || "";

    let formatted = `${timestamp}${prefix}${levelStr} ${message}`;

    if (meta !== undefined) {
      formatted += ` ${JSON.stringify(meta)}`;
    }

    return formatted;
  }
}
