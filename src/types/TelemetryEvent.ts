export type TelemetryEvent<T = Record<string, unknown>> = {
  eventType: string;
  eventName: string;
  payload: T;
  timestamp: string;
  sessionId?: string;
  userId?: string;
};
