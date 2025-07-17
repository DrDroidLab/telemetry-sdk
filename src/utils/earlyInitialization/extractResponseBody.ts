export const extractResponseBody = async (
  response: Response
): Promise<string> => {
  try {
    const clone = response.clone();
    const text = await clone.text();
    return text.length > 1000 ? text.substring(0, 1000) + "..." : text;
  } catch {
    return "";
  }
};
