/**
 * Helper function to extract response body from Response object
 * @param response - The Response object to extract body from
 * @returns The response body as parsed JSON or text
 */
export const extractResponseBody = async (
  response: Response
): Promise<unknown> => {
  try {
    // Check if response is already consumed
    if (response.bodyUsed) {
      return null;
    }

    // Check for empty responses
    if (response.status === 204 || response.status === 304) {
      return null;
    }

    // Check content length to avoid processing very large responses
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      // 1MB limit
      return "[Response too large to capture]";
    }

    const clone = response.clone(); // Clone to avoid consuming the response

    // Set a timeout for reading the response to avoid hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Response read timeout")), 5000);
    });

    const textPromise = clone.text();
    const text = (await Promise.race([textPromise, timeoutPromise])) as string;

    if (text) {
      // Check if it looks like JSON
      const contentType = response.headers.get("content-type") || "";
      if (
        contentType.includes("application/json") ||
        contentType.includes("application/ld+json") ||
        contentType.includes("text/json")
      ) {
        try {
          return JSON.parse(text);
        } catch {
          // If JSON parsing fails, return the raw text
          return text;
        }
      }

      // For other content types, try to parse as JSON first, then fallback to text
      try {
        return JSON.parse(text);
      } catch {
        // If JSON parsing fails, return the raw text (truncated if too long)
        return text.length > 10000 ? text.substring(0, 10000) + "..." : text;
      }
    }
  } catch (error) {
    // If any error occurs, return a descriptive message instead of null
    if (error instanceof Error) {
      return `[Error extracting response: ${error.message}]`;
    }
    return "[Error extracting response]";
  }
  return null;
};

/**
 * Helper function to extract response body from XMLHttpRequest object
 * @param xhr - The XMLHttpRequest object to extract body from
 * @returns The response body as parsed JSON or text
 */
export const extractXHRResponseBody = (xhr: XMLHttpRequest): unknown => {
  try {
    // Check for empty responses
    if (xhr.status === 204 || xhr.status === 304) {
      return null;
    }

    const responseText = xhr.responseText;
    if (responseText) {
      // Check content type
      const contentType = xhr.getResponseHeader("content-type") || "";

      if (
        contentType.includes("application/json") ||
        contentType.includes("application/ld+json") ||
        contentType.includes("text/json")
      ) {
        try {
          return JSON.parse(responseText);
        } catch {
          // If JSON parsing fails, return the raw text
          return responseText;
        }
      }

      // For other content types, try to parse as JSON first, then fallback to text
      try {
        return JSON.parse(responseText);
      } catch {
        // If JSON parsing fails, return the raw text (truncated if too long)
        return responseText.length > 10000
          ? responseText.substring(0, 10000) + "..."
          : responseText;
      }
    }
  } catch (error) {
    // If any error occurs, return a descriptive message
    if (error instanceof Error) {
      return `[Error extracting XHR response: ${error.message}]`;
    }
    return "[Error extracting XHR response]";
  }
  return null;
};
