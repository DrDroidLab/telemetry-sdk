import type { TelemetryEvent } from "../../../types";
import type { HyperlookEvent } from "../types";
import { generateEventId } from "./generateEventId";
import { limitPropertiesSize } from "./limitPropertiesSize";

export function transformEvent(event: TelemetryEvent): HyperlookEvent {
  // Ensure payload is properly handled - limitPropertiesSize will always return at least a message
  const payload = event.payload || {};
  const limitedProperties = limitPropertiesSize(payload);

  // Properties should never be null since limitPropertiesSize ensures at least a message field
  const properties = limitedProperties;

  const transformed: HyperlookEvent = {
    event_id: generateEventId(),
    event_type: event.eventType,
    event_name: event.eventName,
    properties: properties,
    user_properties: null, // Set to null instead of empty object
    timestamp: event.timestamp,
  };

  // Only add optional properties if they have values
  if (event.userId) {
    transformed.user_id = event.userId;
  }
  if (event.sessionId) {
    transformed.session_id = event.sessionId;
  }
  if (typeof window !== "undefined") {
    transformed.page_url = window.location.href;
  }
  if (typeof document !== "undefined") {
    transformed.page_title = document.title;
    transformed.referrer = document.referrer;
  }
  if (typeof window !== "undefined" && window.navigator) {
    transformed.user_agent = window.navigator.userAgent;
  }

  return transformed;
}
