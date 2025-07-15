import type { ResourceTiming } from "../types";

export const captureResourceTiming = (): ResourceTiming[] => {
  const resources = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[];

  return resources.map(resource => ({
    name: resource.name,
    duration: resource.duration,
    size: resource.transferSize || 0,
    type: resource.initiatorType,
  }));
};
