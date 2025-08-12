// Hyperlook event format (matching your TelemetryTracker format)
export type HyperlookEvent = {
  event_id?: string;
  user_id?: string;
  session_id?: string;
  event_type: string;
  event_name: string;
  properties?: Record<string, unknown> | null;
  user_properties?: Record<string, unknown> | null;
  page_url?: string;
  page_title?: string;
  referrer?: string;
  user_agent?: string;
  timestamp?: string;
  sdk_metadata?: {
    version: string;
    [key: string]: unknown;
  };
};
