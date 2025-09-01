export const TELEMETRY_SDK_PREFIX = "[TelemetrySDK]";

export const HYPERLOOK_URL = "http://localhost:8001/events/batch";

// SDK version - automatically updated from package.json during build
export const SDK_VERSION = "1.0.14";

// Maximum batch size for telemetry events (50KB)
export const MAX_BATCH_SIZE_BYTES = 50 * 1024;
