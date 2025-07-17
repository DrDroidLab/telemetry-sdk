export type NetworkEventPayload = {
  url: string;
  method: string;
  responseStatus?: number;
  responseStatusText?: string;
  error?: string;
  duration: number;
  startTime: number;
  endTime: number;
  isSupabaseQuery: boolean;
  queryParams?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
};

export type NetworkEvent = {
  eventType: "network" | "supabase";
  eventName:
    | "fetch_complete"
    | "fetch_error"
    | "xhr_complete"
    | "xhr_error"
    | "supabase_fetch_complete"
    | "supabase_fetch_error"
    | "supabase_xhr_complete"
    | "supabase_xhr_error";
  payload: NetworkEventPayload;
  timestamp: string;
};
