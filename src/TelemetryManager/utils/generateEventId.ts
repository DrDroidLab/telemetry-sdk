/**
 * Generates a unique event ID for telemetry events
 * @returns A unique event ID string
 */
export function generateEventId(): string {
  return "event_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}
