// Stripe-Sessions für Bestellungen: deterministische Parameter, Idempotenz, Wiederverwenden/Ablaufenlassen offener Sessions.
// Alles gegen eine schmale Schnittstelle (StripeLike), damit die Logik ohne Stripe testbar ist.
// deno-lint-ignore no-explicit-any
type Any = any;
export interface StripeLike {
  checkout: {
    sessions: {
      create(params: Any, opts?: { idempotencyKey?: string }): Promise<Any>;
      expire(id: string): Promise<Any>;
      search(params: { query: string; limit?: number }): Promise<{ data: Any[] }>;
    };
  };
}

/** Fenster für den Idempotenzschlüssel und den festen Ablauf der Mischsession (Stripe verlangt >= 30 Min Restlaufzeit). */
export const SESSION_WINDOW_MS = 3 * 60_000;
export const MIXED_EXPIRY_AFTER_WINDOW_START_MIN = 33;

/** Ablaufzeit (Unix-Sekunden) der Mischsession: deterministisch je 3-Minuten-Fenster, damit Wiederholungen identische Parameter haben. */
export function deterministicExpiresAt(now = Date.now()): number {
  const windowStart = Math.floor(now / SESSION_WINDOW_MS) * SESSION_WINDOW_MS;
  return Math.floor((windowStart + MIXED_EXPIRY_AFTER_WINDOW_START_MIN * 60_000) / 1000);
}

/** Kurzer Hash der Session-Parameter: ändert sich ein Parameter (Name, Zahlart, Körbe ...), ändert sich der Schlüssel (kein 400 idempotency_error). */
export async function paramsHash(params: unknown): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(params)));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionIdempotencyKey(orderNumber: string, params: unknown, now = Date.now()): Promise<string> {
  return `cat-${orderNumber}-${await paramsHash(params)}-${Math.floor(now / SESSION_WINDOW_MS)}`;
}

const isIdempotencyError = (e: Any): boolean =>
  e?.type === "StripeIdempotencyError" || e?.code === "idempotency_key_in_use" || e?.raw?.code === "idempotency_key_in_use" || e?.statusCode === 409 && /idempot/i.test(String(e?.message));

/** Session anlegen; bei Idempotenz-Konflikt (parallele Anfrage mit anderem Zwischenstand) einmal mit neuem Schlüssel wiederholen. */
export async function createSessionIdempotent(stripe: StripeLike, params: Any, key: string, wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<Any> {
  try {
    return await stripe.checkout.sessions.create(params, { idempotencyKey: key });
  } catch (e) {
    if (!isIdempotencyError(e)) throw e;
    await wait(1500);
    return await stripe.checkout.sessions.create(params, { idempotencyKey: `${key}-r` });
  }
}

/** Offene Sessions einer Bestellnummer (Suche kann bis ~1 Min nachhinken; Fehler => null = unbekannt). */
export async function findOpenSessions(stripe: StripeLike, orderNumber: string): Promise<Any[] | null> {
  try {
    const r = await stripe.checkout.sessions.search({ query: `metadata['order_number']:'${orderNumber.replace(/'/g, "")}' AND status:'open'`, limit: 10 });
    return r.data ?? [];
  } catch {
    return null;
  }
}

/** Sessions ablaufen lassen. true nur, wenn ALLE sicher expired sind (Voraussetzung, um Korb-Holds freizugeben). */
export async function expireSessions(stripe: StripeLike, sessions: Any[]): Promise<boolean> {
  let all = true;
  for (const s of sessions) {
    try {
      await stripe.checkout.sessions.expire(s.id);
    } catch (e) {
      // schon abgelaufen/abgeschlossen ist ok; alles andere = unsicher
      const msg = String((e as Any)?.message ?? "");
      if (!/expired|complete|not.*open/i.test(msg)) all = false;
    }
  }
  return all;
}

/** Offene Session, die dieselbe Zahlung abbildet (Betrag, noch >= 5 Min offen) und direkt weiterverwendet werden kann. */
export function reusableSession(sessions: Any[], expectedAmountCents: number, now = Date.now()): Any | null {
  return sessions.find((s) => s.url && s.amount_total === expectedAmountCents && (!s.expires_at || s.expires_at * 1000 > now + 5 * 60_000)) ?? null;
}
