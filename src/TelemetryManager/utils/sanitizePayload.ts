import { sanitizeString } from "./sanitizeString";

export function sanitizePayload(
  payload: Record<string, unknown>,
  seen = new WeakSet<object>()
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }

  // Check for circular references
  if (seen.has(payload)) {
    throw new Error("Circular reference detected in payload");
  }

  const sanitized: Record<string, unknown> = {};
  const keys = Object.keys(payload);
  if (keys.length > 100) {
    throw new Error("Payload has too many keys (max 100)");
  }

  // Add current object to seen set to detect circular references
  seen.add(payload);

  try {
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

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[sanitizedKey] = sanitizePayload(
          value as Record<string, unknown>,
          seen
        );
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
  } finally {
    // Remove from seen set when done processing this object
    seen.delete(payload);
  }

  return sanitized;
}
