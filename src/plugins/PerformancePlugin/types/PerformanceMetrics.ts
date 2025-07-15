export type ResourceTiming = {
  name: string;
  duration: number;
  size: number;
  type: string;
};

export type PerformanceMetrics = {
  // Navigation Timing API metrics
  navigationStart: number;
  unloadEventStart: number;
  unloadEventEnd: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domLoading: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;

  // Calculated metrics
  dnsTime: number;
  tcpTime: number;
  requestTime: number;
  responseTime: number;
  domParsingTime: number;
  domContentLoadedTime: number;
  loadCompleteTime: number;
  totalPageLoadTime: number;

  // Resource Timing API metrics
  resourceCount: number;
  resourceLoadTimes: ResourceTiming[];

  // Web Vitals (if available)
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
};
