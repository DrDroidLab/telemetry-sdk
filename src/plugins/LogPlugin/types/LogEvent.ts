export type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

export enum ConsoleEventName {
  LOG = "console_log",
  WARN = "console_warn",
  ERROR = "console_error",
  INFO = "console_info",
  DEBUG = "console_debug",
}

export type LogEventPayload = {
  message: string;
  args: string[];
  stack: string[];
};

export type LogEvent = {
  eventType: "console";
  eventName: ConsoleEventName;
  payload: LogEventPayload;
  timestamp: string;
};
