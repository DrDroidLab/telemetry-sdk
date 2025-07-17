export const extractQueryParams = (url: string): Record<string, string> => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost"
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
