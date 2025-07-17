/**
 * Helper function to extract query parameters from URL
 * @param url - The URL to extract query parameters from
 * @returns Record of query parameters
 */
export const extractQueryParams = (url: string): Record<string, string> => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : ""
    );
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
};
