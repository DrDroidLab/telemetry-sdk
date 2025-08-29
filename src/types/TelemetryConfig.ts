import type { LoggerConfig } from "./Logger";
import type { ExporterType } from "./ExporterTypes";
import type { SessionReplayConfig } from "./SessionReplay";

export type TelemetryConfig = {
  endpoint?: string; // Optional since we use hardcoded Hyperlook URL
  hyperlookApiKey?: string; // API key for Hyperlook exporter
  exporters?: ExporterType[]; // Array of enabled exporters
  enablePageViews?: boolean; // Enable page view tracking
  enableClicks?: boolean;
  enableLogs?: boolean;
  enableNetwork?: boolean;
  enablePerformance?: boolean;
  enableErrors?: boolean; // Enable error tracking
  enableSessionReplay?: boolean; // Enable session replay recording
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number; // Base retry delay for exponential backoff
  maxRetryDelay?: number; // Maximum retry delay cap
  samplingRate?: number;
  logging?: LoggerConfig;
  sessionId?: string;
  userId?: string;
  enableCustomEvents?: boolean;
  captureStreamingMessages?: boolean; // Enable capturing individual streaming messages/chunks

  // Session Replay settings
  sessionReplay?: SessionReplayConfig;

  // Reliability settings
  connectionTimeout?: number; // Connection timeout in milliseconds
  requestTimeout?: number; // Request timeout in milliseconds
  circuitBreakerMaxFailures?: number; // Max consecutive failures before opening circuit
  circuitBreakerTimeout?: number; // Time to wait before attempting half-open
  circuitBreakerFailureThreshold?: number; // Failure rate threshold (0.0-1.0)

  // Hyperlook-specific settings
  hyperlookMaxBatchSize?: number; // Maximum events per batch for Hyperlook
  hyperlookMaxPayloadSize?: number; // Maximum payload size in bytes for Hyperlook
};
