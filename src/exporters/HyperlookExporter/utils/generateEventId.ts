export function generateEventId(): string {
  return "event_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}
