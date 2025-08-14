import type { Logger } from "../types";
import type { CircuitBreakerState } from "./types";

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private logger: Logger;

  constructor(
    logger: Logger,
    maxConsecutiveFailures: number = 10, // Increased from 5
    circuitBreakerTimeout: number = 60000, // Increased from 30000 (1 minute)
    failureThreshold: number = 0.5 // 50% failure rate threshold
  ) {
    // Validate parameters
    if (maxConsecutiveFailures < 1) {
      throw new Error("maxConsecutiveFailures must be at least 1");
    }
    if (circuitBreakerTimeout < 0) {
      throw new Error("circuitBreakerTimeout must be non-negative");
    }
    if (failureThreshold < 0 || failureThreshold > 1) {
      throw new Error("failureThreshold must be between 0 and 1");
    }

    this.logger = logger;
    this.state = {
      consecutiveFailures: 0,
      totalAttempts: 0,
      maxConsecutiveFailures,
      circuitBreakerTimeout,
      failureThreshold,
      lastFailureTime: 0,
      isCircuitOpen: false,
      isHalfOpen: false,
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
      this.transitionToHalfOpen();
      this.logger.info(
        "Circuit breaker transitioning to half-open state - attempting to export events again"
      );
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    this.state.totalAttempts++;

    if (this.state.isHalfOpen) {
      // Success in half-open state, close the circuit
      this.reset();
      this.logger.info(
        "Circuit breaker closed after successful half-open attempt"
      );
    } else {
      // Reset consecutive failures on success
      this.state.consecutiveFailures = 0;
    }
  }

  recordFailure(): void {
    this.state.consecutiveFailures++;
    this.state.totalAttempts++;
    this.state.lastFailureTime = Date.now();

    // Calculate failure rate
    const failureRate =
      this.state.consecutiveFailures / this.state.totalAttempts;

    // Open circuit breaker if too many consecutive failures OR high failure rate
    if (
      this.state.consecutiveFailures >= this.state.maxConsecutiveFailures ||
      (this.state.totalAttempts >= 5 &&
        failureRate >= this.state.failureThreshold)
    ) {
      this.state.isCircuitOpen = true;
      this.state.isHalfOpen = false;
      this.logger.error("Circuit breaker opened due to failures", {
        consecutiveFailures: this.state.consecutiveFailures,
        maxConsecutiveFailures: this.state.maxConsecutiveFailures,
        totalAttempts: this.state.totalAttempts,
        failureRate: failureRate.toFixed(2),
        failureThreshold: this.state.failureThreshold,
      });
    } else if (this.state.isHalfOpen) {
      // Failure in half-open state, open the circuit again
      this.state.isCircuitOpen = true;
      this.state.isHalfOpen = false;
      this.logger.error("Circuit breaker reopened after half-open failure");
    }
  }

  private transitionToHalfOpen(): void {
    this.state.isCircuitOpen = false;
    this.state.isHalfOpen = true;
    // Reset consecutive failures for clean half-open test
    this.state.consecutiveFailures = 0;
  }

  private reset(): void {
    this.state.isCircuitOpen = false;
    this.state.isHalfOpen = false;
    this.state.consecutiveFailures = 0;
    this.state.totalAttempts = 0;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}
