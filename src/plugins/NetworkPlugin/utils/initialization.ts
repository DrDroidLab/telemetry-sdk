export const isNetworkSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof XMLHttpRequest !== "undefined"
  );
};

export const initializeOriginalFetch = (): typeof fetch => {
  if (
    typeof window !== "undefined" &&
    !(window as unknown as Record<string, unknown>)._originalFetch
  ) {
    (window as unknown as Record<string, unknown>)._originalFetch =
      window.fetch;
  }

  return (
    ((window as unknown as Record<string, unknown>)
      ._originalFetch as typeof fetch) || window.fetch
  );
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
