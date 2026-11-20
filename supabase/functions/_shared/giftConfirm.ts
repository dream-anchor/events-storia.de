/**
 * Double-Opt-in für "Zahlung vor Ort" (Inhaber 20.11.2026, kein CAPTCHA):
 * Token (256 Bit, zufällig) geht nur in den Link der Bestätigungsmail; in der DB steht ausschließlich der SHA-256-Hash
 * (gift_orders.confirm_token_hash). Einlösen: confirm-gift-reservation -> RPC gift_confirm_reservation.
 */

/** Hold einer unbestätigten Reservierung in Minuten (danach verfällt sie und gibt den Bestand frei). */
export const CONFIRM_HOLD_MINUTES = 30;
/** Formular frühestens nach dieser Zeit absendbar (Bot-Schutz, Inhaber: z. B. 3 s). */
export const MIN_FORM_FILL_MS = 3000;
/** Zeitstempel älter als dies gilt als abgelaufenes Formular. */
export const MAX_FORM_AGE_MS = 24 * 3600_000;
const FUTURE_SKEW_MS = 60_000;

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function generateConfirmToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashConfirmToken(token: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

export const isConfirmToken = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{64}$/.test(t);

export function confirmUrl(origin: string, lang: "de" | "en", token: string): string {
  return `${origin}${lang === "en" ? "/en" : ""}/geschenkkoerbe/bestaetigen?t=${token}`;
}

/**
 * Plausibilisiert den Client-Zeitstempel des Formular-Öffnens (ms seit Epoch): nicht in der Zukunft, nicht älter als 24 h,
 * und mindestens MIN_FORM_FILL_MS vor dem Absenden. Ein Bot kann den Wert fälschen, scheitert aber an unbedachten Standard-Posts.
 */
export function checkFormTiming(formStartedAt: unknown, nowMs: number): "ok" | "too_fast" | "invalid" {
  const t = Number(formStartedAt);
  if (!Number.isFinite(t) || t <= 0) return "invalid";
  if (t > nowMs + FUTURE_SKEW_MS || nowMs - t > MAX_FORM_AGE_MS) return "invalid";
  return nowMs - t < MIN_FORM_FILL_MS ? "too_fast" : "ok";
}

/** Anzeigename für die Bestätigungsmail: nur Buchstaben/Leerzeichen/Bindestrich/Punkt/Apostroph, max. 20 Zeichen (kein Spam-Relais). */
export function safeShortName(name: string): string {
  return name.replace(/[^\p{L} .'’-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20).trim();
}
