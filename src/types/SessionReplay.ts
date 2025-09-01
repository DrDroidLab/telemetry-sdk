import type { eventWithTime } from "rrweb";

export type SessionReplayEvent = {
  eventType: "session_replay";
  eventName:
    | "session_replay_start"
    | "session_replay_batch"
    | "session_replay_end";
  payload: SessionReplayPayload;
  timestamp: string;
  sessionId?: string;
  userId?: string;
};

export type SessionReplayPayload = {
  sessionId: string;
  events: eventWithTime[];
  metadata: SessionReplayMetadata;
  config: SessionReplayConfig;
  rrweb_type: "session_start" | "events_batch" | "session_end";
};

export type SessionReplayMetadata = {
  startTime: number;
  endTime?: number;
  duration?: number;
  eventCount: number;
  url: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  devicePixelRatio: number;
};

export type SessionReplayConfig = {
  // rrweb configuration options
  recordCanvas?: boolean;
  recordCrossOriginIframes?: boolean;
  recordAfter?: "load" | "DOMContentLoaded";
  inlineStylesheet?: boolean;
  collectFonts?: boolean;
  // Custom masking options
  maskTextInputs?: boolean;
  maskAllInputs?: boolean;
  maskTextSelector?: string;
  maskInputSelector?: string;
  // Performance options
  emit?: (event: eventWithTime) => void;
  checkoutEveryNms?: number;
  checkoutEveryNth?: number;
  blockClass?: string;
  blockSelector?: string;
  ignoreClass?: string;
  maskTextClass?: string;
  slimDOMOptions?: {
    script?: boolean;
    comment?: boolean;
    headFavicon?: boolean;
    headWhitespace?: boolean;
    headMetaDescKeywords?: boolean;
    headMetaSocial?: boolean;
    headMetaRobots?: boolean;
    headMetaHttpEquiv?: boolean;
    headMetaAuthorship?: boolean;
    headMetaVerification?: boolean;
  };
  // Custom options
  maxEvents?: number;
  maxDuration?: number;
  throttleEvents?: boolean;
  throttleDelay?: number;
  batchSize?: number;
};

export type SessionReplayState = {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number;
  eventCount: number;
  lastEventTime: number;
};

export type SessionReplayExporter = {
  exportSession: (sessionData: SessionReplayPayload) => Promise<void>;
  getSession: (sessionId: string) => Promise<SessionReplayPayload | null>;
  listSessions: (
    filters?: SessionReplayFilters
  ) => Promise<SessionReplaySummary[]>;
};

export type SessionReplayFilters = {
  userId?: string;
  startTime?: number;
  endTime?: number;
  url?: string;
  minDuration?: number;
  maxDuration?: number;
};

export type SessionReplaySummary = {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  eventCount: number;
  url: string;
  metadata: Partial<SessionReplayMetadata>;
};
