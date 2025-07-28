// List of content types that are considered streaming
export const STREAMING_CONTENT_TYPES = [
  "text/event-stream",
  "application/octet-stream",
  "application/stream+json",
  "application/x-ndjson", // Newline delimited JSON
  "application/jsonlines", // JSON Lines format
  "text/plain", // Sometimes used for streaming
  "multipart/x-mixed-replace", // Server push
  // Add more streaming types as needed
];

/**
 * Detect if a Response is a streaming response based on various indicators
 * @param response - The Response object to check
 * @returns true if streaming, false otherwise
 */
export function isStreamingResponse(response: Response): boolean {
  // Check if response has a readable stream body
  if (!response.body || typeof response.body.getReader !== "function") {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  const transferEncoding = response.headers.get("transfer-encoding") || "";
  const connection = response.headers.get("connection") || "";
  const cacheControl = response.headers.get("cache-control") || "";
  const contentLength = response.headers.get("content-length");

  // Check for explicit streaming content types
  if (
    STREAMING_CONTENT_TYPES.some(type =>
      contentType.toLowerCase().includes(type.toLowerCase())
    )
  ) {
    return true;
  }

  // Check for chunked transfer encoding (common in streaming)
  if (transferEncoding.toLowerCase().includes("chunked")) {
    return true;
  }

  // Check for Server-Sent Events (most common streaming type)
  if (contentType.toLowerCase().includes("text/event-stream")) {
    return true;
  }

  // Check for WebSocket upgrade responses
  if (
    response.status === 101 &&
    response.headers.get("upgrade")?.toLowerCase() === "websocket"
  ) {
    return true;
  }

  // Check for responses without content-length with chunked encoding
  if (!contentLength && transferEncoding.toLowerCase().includes("chunked")) {
    return true;
  }

  // Check for streaming indicators in cache control headers
  if (
    cacheControl.toLowerCase().includes("no-cache") ||
    cacheControl.toLowerCase().includes("no-store")
  ) {
    // Additional checks for streaming patterns
    if (connection.toLowerCase().includes("keep-alive")) {
      // Check if it's a long-lived connection without content-length
      if (!contentLength) {
        return true;
      }

      // Check for streaming-related headers
      const pragma = response.headers.get("pragma") || "";
      if (pragma.toLowerCase().includes("no-cache")) {
        return true;
      }
    }
  }

  // Check for specific streaming patterns in URLs
  const url = response.url || "";
  const streamingUrlPatterns = [
    "/stream",
    "/events",
    "/sse",
    "/realtime",
    "/live",
    "/feed",
    "/updates",
  ];

  if (
    streamingUrlPatterns.some(pattern => url.toLowerCase().includes(pattern))
  ) {
    // Additional validation - check if it has streaming-like headers
    if (
      !contentLength ||
      transferEncoding.toLowerCase().includes("chunked") ||
      connection.toLowerCase().includes("keep-alive")
    ) {
      return true;
    }
  }

  // Check for specific response status codes that might indicate streaming
  if (response.status === 206) {
    // Partial Content
    return true;
  }

  // Check for custom streaming headers
  const customStreamingHeaders = [
    "x-accel-buffering", // Nginx streaming
    "x-stream", // Custom streaming header
    "x-real-time", // Real-time data header
  ];

  for (const header of customStreamingHeaders) {
    if (response.headers.has(header)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a URL pattern suggests streaming content
 * @param url - The URL to check
 * @returns true if URL suggests streaming, false otherwise
 */
export function isStreamingUrl(url: string): boolean {
  const streamingPatterns = [
    /\/stream/i,
    /\/events/i,
    /\/sse/i,
    /\/realtime/i,
    /\/live/i,
    /\/feed/i,
    /\/updates/i,
    /\/ws/i, // WebSocket
    /\/socket/i,
    /\/push/i,
    /\/notifications/i,
  ];

  return streamingPatterns.some(pattern => pattern.test(url));
}

/**
 * Check if request headers suggest streaming intent
 * @param headers - Request headers
 * @returns true if headers suggest streaming, false otherwise
 */
export function hasStreamingRequestHeaders(
  headers: Headers | Record<string, string>
): boolean {
  const getHeader = (name: string): string => {
    if (headers instanceof Headers) {
      return headers.get(name) || "";
    }
    return headers[name] || headers[name.toLowerCase()] || "";
  };

  const accept = getHeader("accept").toLowerCase();
  const cacheControl = getHeader("cache-control").toLowerCase();

  // Check for streaming accept headers
  if (
    accept.includes("text/event-stream") ||
    accept.includes("application/stream") ||
    accept.includes("text/stream")
  ) {
    return true;
  }

  // Check for no-cache request (common in streaming)
  if (cacheControl.includes("no-cache") || cacheControl.includes("no-store")) {
    return true;
  }

  return false;
}
