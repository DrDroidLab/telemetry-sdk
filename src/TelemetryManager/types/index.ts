export enum TelemetryState {
  INITIALIZING = "initializing",
  RUNNING = "running",
  SHUTTING_DOWN = "shutting_down",
  SHUTDOWN = "shutdown",
  ERROR = "error",
}

export interface CircuitBreakerState {
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  circuitBreakerTimeout: number;
  lastFailureTime: number;
  isCircuitOpen: boolean;
}
