import type { TelemetryEvent } from "../../../types";
import type { HyperlookEvent } from "../types";
import { generateEventId } from "./generateEventId";
import { limitPropertiesSize } from "./limitPropertiesSize";
import { getUserProperties, setUserProperties } from "./index";
import { getLogger } from "../../../logger";

export function transformEvent(event: TelemetryEvent): HyperlookEvent {
  const logger = getLogger();

  try {
    // Validate required fields
    if (!event.eventType || typeof event.eventType !== "string") {
      throw new Error("Event type is required and must be a string");
    }
    if (!event.eventName || typeof event.eventName !== "string") {
      throw new Error("Event name is required and must be a string");
    }
    if (!event.timestamp || typeof event.timestamp !== "string") {
      throw new Error("Event timestamp is required and must be a string");
    }

    // Ensure payload is properly handled - limitPropertiesSize will always return at least a message
    const payload = event.payload || {};
    const limitedProperties = limitPropertiesSize(payload);

    // Properties should never be null since limitPropertiesSize ensures at least a message field
    const properties = { ...limitedProperties };

    // Ensure method, url, and responseStatus are always present if available
    if (typeof payload.method === "string") {
      properties.method = payload.method;
    }
    if (typeof payload.url === "string") {
      properties.url = payload.url;
    }
    if (typeof payload.responseStatus === "number") {
      properties.responseStatus = payload.responseStatus;
    }

    // Handle user properties for identify events and subsequent events
    let userProperties = null;
    if (
      event.eventType === "identify" &&
      event.payload &&
      typeof event.payload === "object"
    ) {
      const payload = event.payload;
      if (
        payload.traits &&
        typeof payload.traits === "object" &&
        payload.traits !== null
      ) {
        userProperties = limitPropertiesSize(
          payload.traits as Record<string, unknown>,
          8192,
          false // Don't add default message for user properties
        );
        // Add userId to user properties
        if (event.userId) {
          userProperties.user_id = event.userId;
        }
        // Store user properties for future events
        if (event.userId) {
          setUserProperties(event.userId, userProperties);
        }
      }
    } else if (event.userId) {
      // For non-identify events with userId, get stored user properties
      userProperties = getUserProperties(event.userId);
      // Add userId to user properties if not already present
      if (userProperties && !userProperties.user_id) {
        userProperties.user_id = event.userId;
      } else if (!userProperties && event.userId) {
        // If no stored properties but we have userId, create minimal user properties
        userProperties = {
          user_id: event.userId,
          message: "[User identified]",
        };
      }
    }

    const transformed: HyperlookEvent = {
      event_id: generateEventId(),
      event_type: event.eventType,
      event_name: event.eventName,
      properties: properties,
      user_properties: userProperties,
      timestamp: event.timestamp,
    };

    // Add SDK metadata if available
    if (event.sdkMetadata) {
      transformed.sdk_metadata = event.sdkMetadata;
    }

    // Only add optional properties if they have values and are in browser environment
    if (event.sessionId) {
      transformed.session_id = event.sessionId;
    }

    // Safely check for browser environment
    if (typeof window !== "undefined" && window.location) {
      try {
        transformed.page_url = window.location.href;
      } catch (error) {
        logger.debug("Failed to get page URL", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (typeof document !== "undefined") {
      try {
        transformed.page_title = document.title;
        transformed.referrer = document.referrer;
      } catch (error) {
        logger.debug("Failed to get document properties", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (typeof window !== "undefined" && window.navigator) {
      try {
        transformed.user_agent = window.navigator.userAgent;
      } catch (error) {
        logger.debug("Failed to get user agent", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Final validation of transformed event
    if (
      !transformed.event_id ||
      !transformed.event_type ||
      !transformed.event_name
    ) {
      throw new Error("Transformed event missing required fields");
    }

    return transformed;
  } catch (error) {
    logger.error("Failed to transform event", {
      eventType: event.eventType,
      eventName: event.eventName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
