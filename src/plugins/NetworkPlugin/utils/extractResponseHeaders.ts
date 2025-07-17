/**
 * Helper function to extract response headers from Response object
 * @param response - The Response object to extract headers from
 * @returns Record of response headers
 */
export const extractResponseHeaders = (
  response: Response
): Record<string, string> => {
  const headers: Record<string, string> = {};
  try {
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
  } catch {
    // Ignore header extraction errors
  }
  return headers;
};

/**
 * Helper function to extract response headers from XMLHttpRequest object
 * @param xhr - The XMLHttpRequest object to extract headers from
 * @returns Record of response headers
 */
export const extractXHRResponseHeaders = (
  xhr: XMLHttpRequest
): Record<string, string> => {
  const headers: Record<string, string> = {};
  try {
    const headerString = xhr.getAllResponseHeaders();
    if (headerString) {
      headerString.split("\r\n").forEach(line => {
        const [key, value] = line.split(": ");
        if (key && value) {
          headers[key.toLowerCase()] = value;
        }
      });
    }
  } catch {
    // Ignore header extraction errors
  }
  return headers;
};
