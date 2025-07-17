import { getLogger } from "../../../logger";

/**
 * Limits the size of properties object to ensure it doesn't exceed 8KB
 * @param properties - The properties object to limit
 * @param maxSizeBytes - Maximum size in bytes (default: 8192 for 8KB)
 * @returns A new properties object that fits within the size limit
 */
export function limitPropertiesSize(
  properties: Record<string, unknown>,
  maxSizeBytes: number = 8192
): Record<string, unknown> {
  const logger = getLogger();

  if (!properties || Object.keys(properties).length === 0) {
    return properties;
  }

  // Filter out properties that are null, undefined, or empty strings/arrays
  const filteredProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value !== null && value !== undefined) {
      if (typeof value === "string" && value.trim() === "") {
        // Keep empty strings for console events as they might be meaningful
        filteredProperties[key] = value;
      } else if (Array.isArray(value) && value.length === 0) {
        // Keep empty arrays for console events as they might be meaningful
        filteredProperties[key] = value;
      } else {
        filteredProperties[key] = value;
      }
    }
  }

  // If all properties were filtered out, return the original properties
  if (Object.keys(filteredProperties).length === 0) {
    return properties;
  }

  // Ensure we always have at least a message field for console events
  if (
    filteredProperties.message === undefined ||
    filteredProperties.message === null
  ) {
    filteredProperties.message = "[No message]";
  }

  // Convert filtered properties to JSON string to check size
  const propertiesString = JSON.stringify(filteredProperties);
  const originalSize = propertiesString.length;

  // If already within limit, return filtered properties
  if (originalSize <= maxSizeBytes) {
    return filteredProperties;
  }

  logger.debug("Properties size limit exceeded, truncating", {
    originalSize,
    maxSizeBytes,
    propertyCount: Object.keys(filteredProperties).length,
  });

  // Create a copy to work with
  const limitedProperties: Record<string, unknown> = {};
  const propertyEntries = Object.entries(filteredProperties);

  // Sort properties by priority: message first, then others alphabetically
  propertyEntries.sort(([keyA], [keyB]) => {
    if (keyA === "message") return -1;
    if (keyB === "message") return 1;
    return keyA.localeCompare(keyB);
  });

  // First pass: add all properties and see if we're within limits
  for (const [key, value] of propertyEntries) {
    limitedProperties[key] = value;
    const currentString = JSON.stringify(limitedProperties);

    // If adding this property exceeds the limit, try to truncate strings
    if (currentString.length > maxSizeBytes) {
      // Try to truncate string values to fit within limits
      const canTruncate = tryTruncateStrings(limitedProperties, maxSizeBytes);
      if (!canTruncate) {
        // If we can't truncate enough, remove non-essential properties
        removeNonEssentialProperties(limitedProperties, key);
        break;
      }
    }
  }

  const finalSize = JSON.stringify(limitedProperties).length;
  const removedCount =
    Object.keys(filteredProperties).length -
    Object.keys(limitedProperties).length;

  logger.debug("Properties truncated successfully", {
    originalSize,
    finalSize,
    removedCount,
    remainingCount: Object.keys(limitedProperties).length,
  });

  return limitedProperties;
}

/**
 * Try to truncate string values in properties to fit within size limit
 */
function tryTruncateStrings(
  properties: Record<string, unknown>,
  maxSizeBytes: number
): boolean {
  let currentSize = JSON.stringify(properties).length;

  // If already within limits, no need to truncate
  if (currentSize <= maxSizeBytes) {
    return true;
  }

  // Try to truncate string values, starting with the longest ones
  const stringEntries = Object.entries(properties)
    .filter(([, value]) => typeof value === "string")
    .sort(([, a], [, b]) => (b as string).length - (a as string).length);

  for (const [key, value] of stringEntries) {
    if (typeof value !== "string") continue;

    let truncatedValue = value;
    const step = Math.max(1, Math.floor(value.length * 0.1)); // Truncate 10% at a time

    while (truncatedValue.length > 10 && currentSize > maxSizeBytes) {
      truncatedValue = truncatedValue.slice(0, -step);
      properties[key] = truncatedValue + "...";
      currentSize = JSON.stringify(properties).length;
    }

    // If we still can't fit, try more aggressive truncation
    if (currentSize > maxSizeBytes) {
      properties[key] = truncatedValue.slice(0, 50) + "...";
      currentSize = JSON.stringify(properties).length;
    }

    // If we still can't fit, give up on this property (except message)
    if (currentSize > maxSizeBytes && key !== "message") {
      delete properties[key];
      currentSize = JSON.stringify(properties).length;
    }
  }

  // Ensure message is never completely removed
  if (!properties.message || typeof properties.message !== "string") {
    properties.message = "[Message truncated]";
  }

  return currentSize <= maxSizeBytes;
}

/**
 * Remove non-essential properties while keeping essential ones
 */
function removeNonEssentialProperties(
  properties: Record<string, unknown>,
  lastAddedKey: string
): void {
  // Essential properties that should always be kept
  const essentialKeys = ["message"];

  // Remove the property that caused the overflow
  if (!essentialKeys.includes(lastAddedKey)) {
    delete properties[lastAddedKey];
  }

  // Remove other non-essential properties if still needed
  const nonEssentialKeys = Object.keys(properties).filter(
    key => !essentialKeys.includes(key)
  );

  for (const key of nonEssentialKeys) {
    delete properties[key];
    const currentSize = JSON.stringify(properties).length;
    if (currentSize <= 8192) {
      break;
    }
  }

  // Ensure we always have a message
  if (!properties.message) {
    properties.message = "[Properties truncated]";
  }
}
