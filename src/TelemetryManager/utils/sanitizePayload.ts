import { sanitizeString } from "./sanitizeString";

export function sanitizePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }
  const sanitized: Record<string, unknown> = {};
  const keys = Object.keys(payload);
  if (keys.length > 100) {
    throw new Error("Payload has too many keys (max 100)");
  }
  for (const key of keys) {
    const sanitizedKey = sanitizeString(key, "payload key");
    const value = payload[key];
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      !Array.isArray(value) &&
      typeof value !== "object"
    ) {
      throw new Error(`Invalid payload value type for key '${sanitizedKey}'`);
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizePayload(
        value as Record<string, unknown>
      );
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  return sanitized;
}
