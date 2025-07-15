export function sanitizeString(input: string, fieldName: string): string {
  if (typeof input !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  // Remove null bytes and control characters without regex
  let sanitized = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if ((code > 31 && code !== 127) || code === 10 || code === 13) {
      sanitized += input[i];
    }
  }
  sanitized = sanitized.trim();
  if (sanitized.length === 0) throw new Error(`${fieldName} cannot be empty`);
  if (sanitized.length > 1000)
    throw new Error(`${fieldName} is too long (max 1000 characters)`);
  return sanitized;
}
