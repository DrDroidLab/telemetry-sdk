import { SDK_VERSION } from "../constants";

/**
 * Gets the current SDK version
 * @returns Current SDK version string
 */
export function getCurrentVersion(): string {
  return SDK_VERSION;
}
