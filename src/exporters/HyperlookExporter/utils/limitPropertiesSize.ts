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

  // Convert properties to JSON string to check size
  const propertiesString = JSON.stringify(properties);
  const originalSize = propertiesString.length;

  // If already within limit, return as is
  if (originalSize <= maxSizeBytes) {
    return properties;
  }

  logger.debug("Properties size limit exceeded, truncating", {
    originalSize,
    maxSizeBytes,
    propertyCount: Object.keys(properties).length,
  });

  // Create a copy to work with
  const limitedProperties: Record<string, unknown> = {};
  const propertyEntries = Object.entries(properties);

  // Sort properties by key name for consistent truncation
  propertyEntries.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  for (const [key, value] of propertyEntries) {
    // Add the property temporarily to check size
    limitedProperties[key] = value;
    const currentString = JSON.stringify(limitedProperties);

    // If adding this property exceeds the limit, remove it and stop
    if (currentString.length > maxSizeBytes) {
      delete limitedProperties[key];
      break;
    }
  }

  const finalSize = JSON.stringify(limitedProperties).length;
  const removedCount =
    Object.keys(properties).length - Object.keys(limitedProperties).length;

  logger.debug("Properties truncated successfully", {
    originalSize,
    finalSize,
    removedCount,
    remainingCount: Object.keys(limitedProperties).length,
  });

  return limitedProperties;
}
