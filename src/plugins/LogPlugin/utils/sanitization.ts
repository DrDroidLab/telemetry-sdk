/**
 * Sanitize console arguments to prevent XSS
 */
export const sanitizeConsoleArgs = (args: unknown[]): string[] => {
  return args.map(arg => {
    try {
      if (typeof arg === "string") {
        // Basic XSS prevention for strings
        return arg
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;")
          .replace(/\//g, "&#x2F;");
      }
      if (typeof arg === "object" && arg !== null) {
        // For objects, try to safely stringify
        const sanitized = JSON.stringify(arg, (_key, value: string) => {
          if (typeof value === "string") {
            return value
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#x27;")
              .replace(/\//g, "&#x2F;");
          }
          return value;
        });
        return typeof sanitized === "string" ? sanitized : "[Object]";
      }
      return String(arg);
    } catch {
      // If stringification fails, return a safe fallback
      return "[Object]";
    }
  });
};
