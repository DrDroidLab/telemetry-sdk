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

  // Validate sampling rate
  if (
    config.samplingRate !== undefined &&
    (config.samplingRate < 0 || config.samplingRate > 1)
  ) {
    throw new Error("Sampling rate must be between 0 and 1");
  }

  // Validate batch size
  if (config.batchSize !== undefined && config.batchSize <= 0) {
    throw new Error("Batch size must be greater than 0");
  }

  // Validate flush interval
  if (config.flushInterval !== undefined && config.flushInterval < 0) {
    throw new Error("Flush interval must be non-negative");
  }

  // Validate retry settings
  if (config.maxRetries !== undefined && config.maxRetries < 0) {
    throw new Error("Max retries must be non-negative");
  }

  if (config.retryDelay !== undefined && config.retryDelay < 0) {
    throw new Error("Retry delay must be non-negative");
  }

  if (config.maxRetryDelay !== undefined && config.maxRetryDelay < 0) {
    throw new Error("Max retry delay must be non-negative");
  }

  if (
    config.retryDelay !== undefined &&
    config.maxRetryDelay !== undefined &&
    config.retryDelay > config.maxRetryDelay
  ) {
    throw new Error("Retry delay cannot be greater than max retry delay");
  }

  // Validate timeout settings
  if (config.connectionTimeout !== undefined && config.connectionTimeout < 0) {
    throw new Error("Connection timeout must be non-negative");
  }

  if (config.requestTimeout !== undefined && config.requestTimeout < 0) {
    throw new Error("Request timeout must be non-negative");
  }

  if (
    config.connectionTimeout !== undefined &&
    config.requestTimeout !== undefined &&
    config.connectionTimeout > config.requestTimeout
  ) {
    throw new Error(
      "Connection timeout cannot be greater than request timeout"
    );
  }

  // Validate circuit breaker settings
  if (
    config.circuitBreakerMaxFailures !== undefined &&
    config.circuitBreakerMaxFailures < 1
  ) {
    throw new Error("Circuit breaker max failures must be at least 1");
  }

  if (
    config.circuitBreakerTimeout !== undefined &&
    config.circuitBreakerTimeout < 0
  ) {
    throw new Error("Circuit breaker timeout must be non-negative");
  }

  if (
    config.circuitBreakerFailureThreshold !== undefined &&
    (config.circuitBreakerFailureThreshold < 0 ||
      config.circuitBreakerFailureThreshold > 1)
  ) {
    throw new Error(
      "Circuit breaker failure threshold must be between 0 and 1"
    );
  }

  // Validate Hyperlook-specific settings
  if (
    config.hyperlookMaxBatchSize !== undefined &&
    config.hyperlookMaxBatchSize < 1
  ) {
    throw new Error("Hyperlook max batch size must be at least 1");
  }

  if (
    config.hyperlookMaxPayloadSize !== undefined &&
    config.hyperlookMaxPayloadSize < 1024
  ) {
    throw new Error("Hyperlook max payload size must be at least 1KB");
  }

  // Validate batch size consistency
  if (
    config.batchSize !== undefined &&
    config.hyperlookMaxBatchSize !== undefined &&
    config.batchSize > config.hyperlookMaxBatchSize
  ) {
    throw new Error(
      "Batch size cannot be greater than Hyperlook max batch size"
    );
  }
}
