// Stripe-Sessions für Bestellungen: deterministische Parameter, Idempotenz, Wiederverwenden/Ablaufenlassen offener Sessions.
// Alles gegen eine schmale Schnittstelle (StripeLike), damit die Logik ohne Stripe testbar ist.
// deno-lint-ignore no-explicit-any
type Any = any;
export interface StripeLike {
  checkout: {
    sessions: {
      create(params: Any, opts?: { idempotencyKey?: string }): Promise<Any>;
      expire(id: string): Promise<Any>;
      retrieve(id: string): Promise<Any>;
      // Es gibt KEIN checkout.sessions.search (Stripe-Search kennt nur charges/customers/invoices/payment_intents/prices/products/subscriptions).
      list(params: { customer_details?: { email: string }; status?: "open" | "complete" | "expired"; created?: number | { gte?: number }; limit?: number; starting_after?: string }): Promise<{ data: Any[]; has_more?: boolean }>;
    };
  };
}

/**
 * Fenster für den Idempotenzschlüssel und den festen Ablauf der Mischsession. Stripe verlangt >= 30 Min Restlaufzeit.
 * Fensterstart liegt höchstens 3 Min zurück, also beträgt die Restlaufzeit 31..34 Min (>= 31 = 1 Min Puffer für Latenz).
 */
export const SESSION_WINDOW_MS = 3 * 60_000;
export const MIXED_EXPIRY_AFTER_WINDOW_START_MIN = 34;
/** Puffer, um den der Korb-Hold die Session überdauern muss. */
export const HOLD_BUFFER_MS = 60_000;

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

/** Alter, bis zu dem offene Sessions gesucht werden (Checkout-Sessions laufen spätestens nach 24 h ab). */
const SESSION_LOOKBACK_S = 2 * 24 * 3600;
const MAX_PAGES = 5;

/**
 * Offene Sessions einer Bestellnummer. Stripe kann Checkout-Sessions nicht per Metadaten suchen: Liste nach
 * customer_details.email + status=open (+ created), danach lokal nach metadata.order_number filtern.
 * Fehler oder mehr als MAX_PAGES Seiten => null = unbekannt.
 */
export async function findOpenSessions(stripe: StripeLike, orderNumber: string, email: string, now = Date.now()): Promise<Any[] | null> {
  try {
    const found: Any[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await stripe.checkout.sessions.list({
        customer_details: { email }, status: "open", created: { gte: Math.floor(now / 1000) - SESSION_LOOKBACK_S }, limit: 100,
        ...(after ? { starting_after: after } : {}),
      });
      const data = r.data ?? [];
      for (const s of data) if (s?.metadata?.order_number === orderNumber && s.status !== "complete" && s.status !== "expired") found.push(s);
      if (!r.has_more || data.length === 0) return found;
      after = data[data.length - 1].id;
    }
    return null;
  } catch {
    return null;
  }
}

export type ExpireOutcome = "expired" | "paid" | "unsafe";

/**
 * Sessions ablaufen lassen. "expired" nur, wenn ALLE sicher expired sind (Voraussetzung, um Korb-Holds freizugeben).
 * "paid" sobald eine Session bezahlt (complete) ist: nichts freigeben, keine neue Session. Alles andere = "unsafe" (Hold bleibt).
 * Der Status wird immer per retrieve bestätigt, Fehlermeldungstexte zählen nicht.
 */
export async function expireSessions(stripe: StripeLike, sessions: Any[]): Promise<ExpireOutcome> {
  let outcome: ExpireOutcome = "expired";
  for (const s of sessions) {
    let status: string | undefined;
    try {
      const r = await stripe.checkout.sessions.expire(s.id);
      status = r?.status;
    } catch { /* Status unten per retrieve klären */ }
    if (status !== "expired") {
      try {
        status = (await stripe.checkout.sessions.retrieve(s.id))?.status;
      } catch {
        status = undefined;
      }
    }
    if (status === "complete") return "paid";
    if (status !== "expired") outcome = "unsafe";
  }
  return outcome;
}

/** Offene Session, die dieselbe Zahlung abbildet (Betrag, noch >= 5 Min offen) und direkt weiterverwendet werden kann. */
export function reusableSession(sessions: Any[], expectedAmountCents: number, now = Date.now()): Any | null {
  return sessions.find((s) => s.url && s.amount_total === expectedAmountCents && (!s.expires_at || s.expires_at * 1000 > now + 5 * 60_000)) ?? null;
}
