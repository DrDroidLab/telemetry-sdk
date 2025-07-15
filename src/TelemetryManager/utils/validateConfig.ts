import type { TelemetryConfig } from "../../types";

export function validateConfig(config: TelemetryConfig): void {
  if (!config.endpoint || config.endpoint.trim() === "") {
    throw new Error("Telemetry endpoint is required");
  }

  try {
    new URL(config.endpoint);
  } catch {
    throw new Error("Invalid endpoint URL format");
  }

  if (
    config.samplingRate !== undefined &&
    (config.samplingRate < 0 || config.samplingRate > 1)
  ) {
    throw new Error("Sampling rate must be between 0 and 1");
  }

  if (config.batchSize !== undefined && config.batchSize <= 0) {
    throw new Error("Batch size must be greater than 0");
  }

  if (config.flushInterval !== undefined && config.flushInterval < 0) {
    throw new Error("Flush interval must be non-negative");
  }

  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    throw new Error("Max retries must be non-negative");
  }

  if (config.retryDelay !== undefined && config.retryDelay < 0) {
    throw new Error("Retry delay must be non-negative");
  }
}
