export const isNetworkSupported = (): boolean => {
  // In browser environment, require both fetch and XMLHttpRequest
  if (typeof window !== "undefined") {
    return (
      typeof fetch !== "undefined" && typeof XMLHttpRequest !== "undefined"
    );
  }

  // In Node.js environment, only require fetch (XMLHttpRequest not available)
  return typeof fetch !== "undefined";
};

export const initializeOriginalFetch = (): typeof fetch => {
  // In browser environment
  if (typeof window !== "undefined") {
    if (!(window as unknown as Record<string, unknown>)._originalFetch) {
      (window as unknown as Record<string, unknown>)._originalFetch =
        window.fetch;
    }

    return (
      ((window as unknown as Record<string, unknown>)
        ._originalFetch as typeof fetch) || window.fetch
    );
  }

  // In Node.js environment, return the global fetch
  return globalThis.fetch;
};

export const createOriginalXHROpen =
  (): typeof XMLHttpRequest.prototype.open => {
    return function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      password?: string | null
    ) {
      return XMLHttpRequest.prototype.open.call(
        this,
        method,
        url,
        async === undefined ? true : async,
        user,
        password
      );
    };
  };

export const createOriginalXHRSend =
  (): typeof XMLHttpRequest.prototype.send => {
    return function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      return XMLHttpRequest.prototype.send.call(this, body);
    };
  };
