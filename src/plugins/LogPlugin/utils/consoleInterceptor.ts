import { ConsoleEventName, type ConsoleMethod, type LogEvent } from "../types";
import { sanitizeConsoleArgs } from "./sanitization";
import { TELEMETRY_SDK_PREFIX } from "../../../constants";

export type ConsoleInterceptorContext = {
  originals: Partial<Record<ConsoleMethod, typeof console.log>>;
  safeCapture: (event: LogEvent) => void;
};

export const createConsoleInterceptor = (
  method: ConsoleMethod,
  context: ConsoleInterceptorContext
) => {
  const { originals, safeCapture } = context;

  return (...args: unknown[]) => {
    // 1. forward to the real console using the stored original
    const original = originals[method];
    if (original) {
      original.apply(console, args);
    }

    // 2. check if this is our own SDK log to prevent infinite recursion
    const sanitizedArgs = sanitizeConsoleArgs(args);
    const message = sanitizedArgs.join(" ");

    if (!message.includes(TELEMETRY_SDK_PREFIX)) {
      // 3. emit telemetry event with sanitized data
      let eventName: ConsoleEventName;
      switch (method) {
        case "log":
          eventName = ConsoleEventName.LOG;
          break;
        case "warn":
          eventName = ConsoleEventName.WARN;
          break;
        case "error":
          eventName = ConsoleEventName.ERROR;
          break;
        case "info":
          eventName = ConsoleEventName.INFO;
          break;
        case "debug":
          eventName = ConsoleEventName.DEBUG;
          break;
        default:
          eventName = ConsoleEventName.LOG;
      }

      const evt: LogEvent = {
        eventType: "console",
        eventName: eventName,
        payload: {
          message: sanitizedArgs.join(" "),
          args: sanitizedArgs.map(arg => {
            if (typeof arg === "object") {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          }),
          stack: new Error().stack?.split("\n").slice(2, 7) || [],
        },
        timestamp: new Date().toISOString(),
      };
      safeCapture(evt);
    }
  };
};

export const setupConsoleInterceptors = (
  context: ConsoleInterceptorContext
) => {
  const methods: ConsoleMethod[] = ["log", "info", "warn", "error", "debug"];

  methods.forEach(method => {
    // Store the original method BEFORE replacing it
    context.originals[method] = console[method].bind(console);
    console[method] = createConsoleInterceptor(method, context);
  });
};
