import type { TelemetryConfig } from "../../types";
import { ExporterType } from "../../types/ExporterTypes";

export function validateConfig(config: TelemetryConfig): void {
  // Endpoint validation removed since we use hardcoded Hyperlook URL

  // Validate Hyperlook API key if Hyperlook exporter is enabled
  const exportersToEnable = config.exporters ?? [ExporterType.HYPERLOOK];
  if (
    exportersToEnable.includes(ExporterType.HYPERLOOK) &&
    !config.hyperlookApiKey
  ) {
    throw new Error(
      "Hyperlook API key is required when Hyperlook exporter is enabled"
    );
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
