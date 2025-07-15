import type { Logger } from "../types";
import type { CircuitBreakerState } from "./types";

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private logger: Logger;

  constructor(
    logger: Logger,
    maxConsecutiveFailures: number = 5,
    circuitBreakerTimeout: number = 30000
  ) {
    this.logger = logger;
    this.state = {
      consecutiveFailures: 0,
      maxConsecutiveFailures,
      circuitBreakerTimeout,
      lastFailureTime: 0,
      isCircuitOpen: false,
    };
  }

  isOpen(): boolean {
    if (!this.state.isCircuitOpen) {
      return false;
    }

    // Check if enough time has passed to try again
    if (
      Date.now() - this.state.lastFailureTime >
      this.state.circuitBreakerTimeout
    ) {
      this.reset();
      this.logger.info(
        "Circuit breaker reset - attempting to export events again"
      );
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    this.state.consecutiveFailures = 0;
    this.state.isCircuitOpen = false;
  }

  recordFailure(): void {
    this.state.consecutiveFailures++;
    this.state.lastFailureTime = Date.now();

    // Open circuit breaker if too many consecutive failures
    if (this.state.consecutiveFailures >= this.state.maxConsecutiveFailures) {
      this.state.isCircuitOpen = true;
      this.logger.error("Circuit breaker opened due to consecutive failures", {
        consecutiveFailures: this.state.consecutiveFailures,
        maxConsecutiveFailures: this.state.maxConsecutiveFailures,
      });
    }
  }

  private reset(): void {
    this.state.isCircuitOpen = false;
    this.state.consecutiveFailures = 0;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}
