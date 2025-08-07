export * from "./generateEventId";
export * from "./transformEvent";
export * from "./limitPropertiesSize";

// User properties store to maintain user traits across events
const userPropertiesStore = new Map<string, Record<string, unknown>>();

export function getUserProperties(
  userId?: string
): Record<string, unknown> | null {
  if (!userId) return null;
  return userPropertiesStore.get(userId) || null;
}

export function setUserProperties(
  userId: string,
  properties: Record<string, unknown>
): void {
  userPropertiesStore.set(userId, properties);
}

export function clearUserProperties(userId: string): void {
  userPropertiesStore.delete(userId);
}

export function clearAllUserProperties(): void {
  userPropertiesStore.clear();
}
