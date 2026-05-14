const KEY = "storia_funnel_utm";
const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export type UtmData = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  source_url?: string | null;
};

export function captureUtm(): void {
  if (typeof window === "undefined") return;
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return;
    const params = new URLSearchParams(window.location.search);
    const data: UtmData = { source_url: window.location.href };
    let any = false;
    for (const k of KEYS) {
      const v = params.get(k);
      if (v) { (data as Record<string, string | null>)[k] = v.slice(0, 200); any = true; }
    }
    if (!any && document.referrer) {
      data.utm_source = "referrer";
      data.utm_medium = "referral";
      data.utm_campaign = document.referrer.slice(0, 200);
    }
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* noop */ }
}

export function readUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { source_url: window.location.href };
    return JSON.parse(raw) as UtmData;
  } catch { return {}; }
}

export function clearUtm(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}