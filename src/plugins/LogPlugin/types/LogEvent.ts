export type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

export type LogEventPayload = {
  method: ConsoleMethod;
  args: string[];
  originalArgsCount: number;
};

export type LogEvent = {
  eventType: "log";
  eventName: `console.${ConsoleMethod}`;
  payload: LogEventPayload;
  timestamp: string;
};
