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
  // New fields for better network tracking
  isStreaming?: boolean;
  isKeepAlive?: boolean;
  // SSE-specific fields
  connectionId?: string;
  sseState?: "connected" | "message" | "error" | "closed";
  sseMessageId?: string;
  sseMessageType?: string;
  sseMessageCount?: number;
  // Generic streaming fields
  streamContentType?: string;
  streamChunkCount?: number;
  streamChunkSize?: number;
};

export type NetworkEvent = {
  eventType: "network" | "supabase";
  eventName:
    | "fetch_complete"
    | "fetch_error"
    | "fetch_sse_initiated"
    | "fetch_streaming"
    | "xhr_complete"
    | "xhr_error"
    | "supabase_fetch_complete"
    | "supabase_fetch_error"
    | "supabase_fetch_sse_initiated"
    | "supabase_fetch_streaming"
    | "supabase_xhr_complete"
    | "supabase_xhr_error"
    // SSE event names
    | "sse_connection_opened"
    | "sse_message_received"
    | "sse_connection_error"
    | "sse_connection_closed"
    | "sse_fetch_stream_started"
    | "sse_fetch_message_received"
    | "sse_fetch_stream_ended"
    | "sse_fetch_stream_error"
    // Generic streaming event names
    | "fetch_stream_started"
    | "fetch_stream_chunk_received"
    | "fetch_stream_ended"
    | "fetch_stream_error";
  payload: NetworkEventPayload;
  timestamp: string;
};
