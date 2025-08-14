export type TelemetryEvent<T = Record<string, unknown>> = {
  eventType: string;
  eventName: string;
  payload: T;
  timestamp: string;
  event_id?: string; // Optional event ID - will be assigned by ExportManager
  sessionId?: string;
  userId?: string;
  sdkMetadata?: {
    version: string;
    [key: string]: unknown;
  };
};
