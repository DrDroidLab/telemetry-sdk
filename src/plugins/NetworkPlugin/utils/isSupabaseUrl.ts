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
    // If URL parsing fails, fall back to string includes
    const isSupabase =
      url.includes("supabase.co") || url.includes("supabase.com");

    return isSupabase;
  }
};
