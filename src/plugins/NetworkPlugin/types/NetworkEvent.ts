export type NetworkEventPayload = {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  error?: string;
  duration: number;
  timestamp: string;
  type: "fetch" | "xhr";
};

export type NetworkEvent = {
  eventType: "network";
  eventName: "fetch" | "fetch_error" | "xhr";
  payload: NetworkEventPayload;
  timestamp: string;
};
