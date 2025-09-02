export const TELEMETRY_SDK_PREFIX = "[TelemetrySDK]";

export const HYPERLOOK_URL = "https://ingest.hyperlook.io/events/batch";

// SDK version - automatically updated from package.json during build
export const SDK_VERSION = "1.0.17";

// Maximum batch size for telemetry events (100KB)
export const MAX_BATCH_SIZE_BYTES = 100 * 1024;
