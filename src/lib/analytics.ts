/**
 * GA4 Event Tracking Helper
 * Wraps window.gtag — safe to call even before consent (Consent Mode v2 handles filtering).
 */
export const trackEvent = (
  eventName: string,
  params?: Record<string, string | number | boolean | object>
) => {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
};
