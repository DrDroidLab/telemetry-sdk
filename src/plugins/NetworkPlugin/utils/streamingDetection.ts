// List of content types that are considered streaming
export const STREAMING_CONTENT_TYPES = [
  "text/event-stream",
  "application/octet-stream",
  // Add more streaming types as needed
];

/**
 * Detect if a Response is a streaming response based on body and content-type
 * @param response - The Response object to check
 * @returns true if streaming, false otherwise
 */
export function isStreamingResponse(response: Response): boolean {
  if (response.body && typeof response.body.getReader === "function") {
    const contentType = response.headers.get("content-type") || "";
    return STREAMING_CONTENT_TYPES.some(type => contentType.includes(type));
  }
  return false;
}
