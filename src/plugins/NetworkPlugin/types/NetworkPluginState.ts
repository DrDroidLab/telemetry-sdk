export type NetworkPluginState = {
  originalFetch: typeof fetch;
  originalXHROpen: typeof XMLHttpRequest.prototype.open;
  originalXHRSend: typeof XMLHttpRequest.prototype.send;
  unregister: (() => void) | null;
  telemetryEndpoint: string;
  xhrHandlers: WeakMap<XMLHttpRequest, () => void>;
  patchedXHRs: Set<XMLHttpRequest>;
};
