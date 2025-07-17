/**
 * Helper function to detect Supabase URLs more accurately
 * @param url - The URL to check
 * @returns true if the URL is a Supabase endpoint, false otherwise
 */
export const isSupabaseUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : ""
    );
    const hostname = urlObj.hostname.toLowerCase();

    const isSupabase =
      hostname.includes("supabase.co") || hostname.includes("supabase.com");

    return isSupabase;
  } catch {
    // If URL parsing fails, we can't reliably determine if it's a Supabase URL
    // Return false to avoid false positives
    return false;
  }
};
