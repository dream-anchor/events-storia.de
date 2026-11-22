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
      list(params: { status?: "open" | "complete" | "expired"; created?: number | { gte?: number }; limit?: number; starting_after?: string }): Promise<{ data: Any[]; has_more?: boolean }>;
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

/** Offene Checkout-Sessions leben höchstens 24 h; +1 h Puffer. Ältere offene Sessions gibt es nicht. */
const SESSION_LOOKBACK_S = 25 * 3600;
const MAX_PAGES = 10;

// deno-lint-ignore no-explicit-any
type Supa = any;

/** Session-IDs einer Bestellnummer aus der Tabelle catering_checkout_sessions. null = nicht lesbar (Tabelle fehlt/Fehler). */
export async function loadSessionLedger(supabase: Supa, orderNumber: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.from("catering_checkout_sessions").select("session_id").eq("order_number", orderNumber);
    if (error) return null;
    return (data ?? []).map((r: { session_id: string }) => r.session_id);
  } catch {
    return null;
  }
}

/** Session-ID zur Bestellung merken. Fehlertolerant: fehlt die Tabelle (Function vor Migration), passiert nichts. */
export async function recordSession(supabase: Supa, orderNumber: string, sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("catering_checkout_sessions").upsert({ session_id: sessionId, order_number: orderNumber }, { onConflict: "session_id", ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

export interface FoundSessions {
  /** Noch nicht abgelaufene Sessions der Bestellung (offen oder bereits bezahlt/complete). */
  sessions: Any[];
  /** true nur, wenn die Suche nachweislich vollständig war (Ledger lesbar, jede bekannte ID abrufbar, Liste bis has_more=false gelesen). */
  complete: boolean;
}

/**
 * Sessions einer Bestellnummer. Zwei Wege, weil Stripe Checkout-Sessions nicht nach Metadaten suchen lässt und customer_details bei
 * offenen Sessions leer ist:
 *  1. Ledger (Tabelle catering_checkout_sessions): jede bekannte ID wird per retrieve geprüft (findet auch bezahlte, deren Webhook
 *     noch aussteht).
 *  2. Rückfall für Altbestand/fehlende Einträge: list(status=open) und list(status=complete), je created >= jetzt-25h, komplett
 *     durchblättern, lokal nach metadata.order_number filtern (bezahlte Sessions außerhalb des Ledgers => 'paid', nie Freigabe).
 * Eine leere Trefferliste ist nur dann "nichts offen", wenn complete=true; Fehler, nicht ausgeschöpftes has_more oder ein
 * nicht lesbares Ledger setzen complete=false.
 */
export async function findOpenSessions(stripe: StripeLike, orderNumber: string, knownIds: string[] | null, now = Date.now()): Promise<FoundSessions> {
  const byId = new Map<string, Any>();
  let complete = knownIds !== null;
  for (const id of knownIds ?? []) {
    try {
      const s = await stripe.checkout.sessions.retrieve(id);
      if (s && s.status !== "expired") byId.set(id, s);
    } catch {
      complete = false;
    }
  }
  // Rückfall: offene UND bezahlte (complete, auch SEPA complete/unpaid) Sessions, je Status vollständig geblättert (gleiches Seitenlimit).
  // Eine bezahlte Session, die nicht im Ledger steht (recordSession gescheitert, Altbestand), darf nie unsichtbar bleiben.
  for (const status of ["open", "complete"] as const) {
    try {
      let after: string | undefined;
      let exhausted = false;
      for (let page = 0; page < MAX_PAGES && !exhausted; page++) {
        const r = await stripe.checkout.sessions.list({
          status, created: { gte: Math.floor(now / 1000) - SESSION_LOOKBACK_S }, limit: 100,
          ...(after ? { starting_after: after } : {}),
        });
        const data = r.data ?? [];
        for (const s of data) if (s?.metadata?.order_number === orderNumber && s.status !== "expired" && !byId.has(s.id)) byId.set(s.id, s);
        if (!r.has_more || data.length === 0) exhausted = true;
        else after = data[data.length - 1].id;
      }
      if (!exhausted) complete = false;
    } catch {
      complete = false;
    }
  }
  return { sessions: [...byId.values()], complete };
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

/** Wie expireSessions, aber eine unvollständige Suche zählt nie als "sicher abgelaufen" (leere Liste ohne Beweis = unsafe). */
export async function settleSessions(stripe: StripeLike, found: FoundSessions): Promise<ExpireOutcome> {
  const outcome = await expireSessions(stripe, found.sessions);
  return outcome === "expired" && !found.complete ? "unsafe" : outcome;
}

export type SessionGate = "paid" | "retry_later" | "proceed";

/**
 * Entscheidung nach settleSessions. "paid": 409, nichts freigeben, keine neue Session. "unsafe" bei einer FORTGESETZTEN Bestellung:
 * 503 "bitte erneut versuchen", keine neue Session (sonst könnte eine unsichtbare, noch bezahlbare Session doppelt bezahlt werden),
 * keine Freigabe. Eine frisch angelegte Bestellung hat nie Vorgänger-Sessions: dort bleibt "unsafe" folgenlos (nur keine Freigabe
 * älterer Körbe), damit der Checkout vor der Migration 096000 nicht komplett ausfällt.
 */
export function sessionGate(outcome: ExpireOutcome, orderStatus: "created" | "resumed"): SessionGate {
  if (outcome === "paid") return "paid";
  if (outcome === "unsafe" && orderStatus === "resumed") return "retry_later";
  return "proceed";
}

/** Offene Session, die dieselbe Zahlung abbildet (Betrag, noch >= 5 Min offen) und direkt weiterverwendet werden kann. */
export function reusableSession(sessions: Any[], expectedAmountCents: number, now = Date.now()): Any | null {
  return sessions.find((s) => s.url && s.status !== "complete" && s.status !== "expired" && s.amount_total === expectedAmountCents && (!s.expires_at || s.expires_at * 1000 > now + 5 * 60_000)) ?? null;
}
