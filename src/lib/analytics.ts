/**
 * GA4 Event Tracking Helper
 * Wraps window.gtag — safe to call even before consent (Consent Mode v2 handles filtering).
 */
export type GtagParamValue = string | number | boolean | GtagParamValue[] | { [key: string]: GtagParamValue };

export const trackEvent = (
  eventName: string,
  params?: Record<string, GtagParamValue>
) => {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
};
