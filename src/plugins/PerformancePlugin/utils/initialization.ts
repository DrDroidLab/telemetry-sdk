export const isPerformanceSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof performance !== "undefined" &&
    typeof document !== "undefined"
  );
};

export const isPageFullyLoaded = (): boolean => {
  return document.readyState === "complete";
};

export const waitForPageLoad = (callback: () => void): void => {
  if (isPageFullyLoaded()) {
    callback();
  } else {
    window.addEventListener("load", callback);
  }
};
