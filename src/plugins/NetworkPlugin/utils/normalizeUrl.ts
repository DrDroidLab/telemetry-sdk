/**
 * Normalize a URL to an absolute URL
 * Converts relative URLs like "/api/chat" to full URLs like "https://example.com/api/chat"
 */
export function normalizeUrl(url: string | URL): string {
  if (typeof url === "object" && url instanceof URL) {
    return url.toString();
  }

  const urlString = String(url);

  // If it's already an absolute URL, return as-is
  if (urlString.startsWith("http://") || urlString.startsWith("https://")) {
    return urlString;
  }

  // If it's a protocol-relative URL, add current protocol
  if (urlString.startsWith("//")) {
    return `${window.location.protocol}${urlString}`;
  }

  // If it's a relative URL, make it absolute using current origin
  if (urlString.startsWith("/")) {
    return `${window.location.origin}${urlString}`;
  }

  // If it's a relative path without leading slash, resolve against current path
  const currentPath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.substring(
        0,
        window.location.pathname.lastIndexOf("/") + 1
      );

  return `${window.location.origin}${currentPath}${urlString}`;
}
