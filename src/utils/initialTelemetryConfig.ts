import type { TelemetryConfig } from "../types/TelemetryConfig";
import { ExporterType } from "../types/ExporterTypes";

export const initialTelemetryConfig: TelemetryConfig = {
  // Core settings
  exporters: [ExporterType.HYPERLOOK],

  // Feature flags - enable useful features by default
  enablePageViews: true,
  enableClicks: true,
  enableLogs: true,
  enableNetwork: true,
  enablePerformance: true,
  enableErrors: true,
  enableCustomEvents: false, // Disabled by default to avoid noise
  enableSessionReplay: false, // Disabled by default - requires explicit opt-in
  captureStreamingMessages: true,

  // Session Replay settings - only used when enableSessionReplay is true
  sessionReplay: {
    // rrweb configuration options
    recordCanvas: false,
    recordCrossOriginIframes: false,
    recordAfter: "load",
    inlineStylesheet: true,
    collectFonts: false,
    checkoutEveryNms: 15000, // Reduced frequency for better performance
    checkoutEveryNth: 1000, // Reduced frequency for better performance
    blockClass: "rr-block",
    ignoreClass: "rr-ignore",
    maskTextClass: "rr-mask",
    slimDOMOptions: {
      script: true,
      comment: true,
      headFavicon: true,
      headWhitespace: true,
      headMetaDescKeywords: true,
      headMetaSocial: true,
      headMetaRobots: true,
      headMetaHttpEquiv: true,
      headMetaAuthorship: true,
      headMetaVerification: true,
    },
    // Session limits (reduced for better performance)
    maxEvents: 10000,
    maxDuration: 1000000, // 10 minutes (reduced from 30 minutes)
    // Batching configuration for hybrid approach
    batchSize: 50, // Larger batches for fewer network requests
    throttleEvents: false,
    throttleDelay: 100,
    // Privacy settings
    maskTextInputs: true,
    maskAllInputs: false,
    maskTextSelector: 'input[type="password"], input[type="email"], .sensitive',
    maskInputSelector: 'input[type="password"], input[type="email"]',
  },

  // Reliability settings - optimized for production use
  batchSize: 25, // Smaller batches for better reliability
  flushInterval: 15000, // 15 seconds - more frequent flushes
  maxRetries: 5, // Increased from 1 for better reliability
  retryDelay: 1000, // Base delay for exponential backoff
  maxRetryDelay: 30000, // Maximum delay cap

  // Timeout settings
  connectionTimeout: 10000, // 10 seconds for connection
  requestTimeout: 45000, // 45 seconds for request completion

  // Circuit breaker settings
  circuitBreakerMaxFailures: 10, // Conservative failure threshold
  circuitBreakerTimeout: 60000, // 1 minute before recovery
  circuitBreakerFailureThreshold: 0.5, // 50% failure rate threshold

  // Hyperlook-specific settings
  hyperlookMaxBatchSize: 25, // Match batch size for consistency
  hyperlookMaxPayloadSize: 100 * 1024, // 100KB max payload size

  // Sampling and logging
  samplingRate: 1.0, // Full sampling by default
  logging: {
    enableConsole: false, // Disabled by default for production
  },
};
