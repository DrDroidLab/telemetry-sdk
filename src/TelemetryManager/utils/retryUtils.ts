import type { EnhancedError } from "../types";

/**
 * Checks if an error is retryable based on the EnhancedError interface
 * @param error - The error to check
 * @returns true if the error is retryable, false otherwise
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && "isRetryable" in error) {
    return (error as EnhancedError).isRetryable !== false;
  }
  return true; // Default to retryable if we can't determine
}

/**
 * Checks if any error in an array is non-retryable
 * @param errors - Array of errors to check
 * @returns true if any error is non-retryable, false if all are retryable
 */
export function hasNonRetryableError(errors: unknown[]): boolean {
  return errors.some(error => !isRetryableError(error));
}

/**
 * Extracts error messages from an array of errors
 * @param errors - Array of errors
 * @returns Array of error messages
 */
export function extractErrorMessages(errors: unknown[]): string[] {
  return errors.map(error =>
    error instanceof Error ? error.message : String(error)
  );
}
