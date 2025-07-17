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

    const clone = response.clone(); // Clone to avoid consuming the response
    const text = await clone.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        // If JSON parsing fails, return the raw text
        return text;
      }
    }
  } catch {
    // If any error occurs, return null
    return null;
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
    const responseText = xhr.responseText;
    if (responseText) {
      try {
        return JSON.parse(responseText);
      } catch {
        // If JSON parsing fails, return the raw text
        return responseText;
      }
    }
  } catch {
    // If any error occurs, return null
    return null;
  }
  return null;
};
