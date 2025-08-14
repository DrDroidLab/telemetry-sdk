export enum TelemetryState {
  INITIALIZING = "initializing",
  RUNNING = "running",
  SHUTTING_DOWN = "shutting_down",
  SHUTDOWN = "shutdown",
  ERROR = "error",
}

export interface CircuitBreakerState {
  consecutiveFailures: number;
  totalAttempts: number;
  maxConsecutiveFailures: number;
  circuitBreakerTimeout: number;
  failureThreshold: number;
  lastFailureTime: number;
  isCircuitOpen: boolean;
  isHalfOpen: boolean;
}

export interface EnhancedError extends Error {
  isRetryable?: boolean;
  errorType?: string;
}
