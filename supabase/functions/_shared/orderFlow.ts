// Bestellung anlegen oder fortsetzen (Abdichtung, B1/B2): gekapselt, damit die Handler-Logik ohne Stripe/HTTP testbar ist.
// Ergebnis ist immer eines von: created | resumed | conflict | failed.
//  * resumed: dieselbe Nummer gibt es schon, ist unbezahlt und stimmt in E-Mail, Betrag, Positionen, Termin, Adresse und Lieferart
//    überein (Fingerabdruck) -> weiterverwenden (z. B. nach einem Stripe-Fehler).
//  * conflict/mismatch: Nummer gibt es, aber mit anderem Inhalt -> die alte UNBEZAHLTE Zeile wird storniert (keine Waise), der
//    Aufrufer gibt den alten Korb-Hold frei und der Kunde bekommt eine neue Nummer.
//  * conflict/paid: schon bezahlt -> nichts anfassen.
//  * conflict/race: gleichzeitige Anfrage derselben Nummer hat die Zeile angelegt (UNIQUE 23505) und ist noch in Arbeit -> NICHTS
//    freigeben oder stornieren (die andere Anfrage hält Korb und Stripe-Session).
import type { OrderQuote } from "./orderQuote.ts";
import type { CreateInput } from "./orderCreate.ts";

// deno-lint-ignore no-explicit-any
type Supa = any;

export type EnsureResult =
  | { status: "created" | "resumed"; orderId: string }
  | { status: "conflict"; reason: "mismatch" | "paid" | "race" }
  | { status: "failed"; message: string; code?: string };

interface ExistingRow {
  id: string;
  customer_email: string;
  total_amount: number | string | null;
  payment_status: string | null;
  items?: { id?: string; quantity?: number }[] | null;
  is_pickup?: boolean | null;
  delivery_street?: string | null;
  delivery_zip?: string | null;
  delivery_city?: string | null;
  desired_date?: string | null;
  desired_time?: string | null;
  package_id?: string | null;
  guest_count?: number | null;
  event_date?: string | null;
  event_time?: string | null;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const hhmm = (v: unknown) => String(v ?? "").slice(0, 5);
const day = (v: unknown) => String(v ?? "").slice(0, 10);

/** Stimmt eine vorhandene Zeile mit dem überein, was der Kunde jetzt bestellen will? */
export function matchesExisting(row: ExistingRow, quote: OrderQuote, input: CreateInput): boolean {
  if (norm(row.customer_email) !== norm(input.customer.email)) return false;
  if (Math.round(Number(row.total_amount) * 100) !== quote.totalCents) return false;
  if (quote.kind === "event") {
    const first = quote.lines[0];
    return day(row.event_date) === input.date && hhmm(row.event_time) === input.time
      && !!first && row.package_id === first.id.replace(/^event-/, "") && row.guest_count === first.quantity;
  }
  if (day(row.desired_date) !== input.date || hhmm(row.desired_time) !== input.time) return false;
  if (!!row.is_pickup !== quote.isPickup) return false;
  if (!quote.isPickup) {
    if (norm(row.delivery_street) !== norm(input.address.street) || norm(row.delivery_zip) !== norm(input.address.zip)
      || norm(row.delivery_city) !== norm(input.address.city)) return false;
  }
  const stored = (row.items ?? []).map((i) => `${i.id}:${i.quantity}`).sort().join("|");
  const wanted = quote.lines.map((l) => `${l.id}:${l.quantity}`).sort().join("|");
  return stored === wanted;
}

export async function ensureOrder(
  supabase: Supa,
  a: { quote: OrderQuote; input: CreateInput; orderId: string; payload: Record<string, unknown> },
): Promise<EnsureResult> {
  const isEvent = a.quote.kind === "event";
  const view = isEvent ? "event_bookings" : "catering_orders";
  const numberColumn = isEvent ? "booking_number" : "order_number";
  const columns = isEvent
    ? "id, customer_email, total_amount, payment_status, package_id, guest_count, event_date, event_time"
    : "id, customer_email, total_amount, payment_status, items, is_pickup, delivery_street, delivery_zip, delivery_city, desired_date, desired_time";

  const lookup = async (): Promise<ExistingRow | null> => {
    const { data, error } = await supabase.from(view).select(columns).eq(numberColumn, a.input.orderNumber).maybeSingle();
    if (error) throw new Error(`order_lookup_failed: ${error.message}`);
    return data ?? null;
  };

  const existing = await lookup();
  if (existing) {
    if (existing.payment_status === "paid") return { status: "conflict", reason: "paid" };
    if (matchesExisting(existing, a.quote, a.input)) return { status: "resumed", orderId: existing.id };
    // Andere Eingaben unter alter Nummer: unbezahlte Zeile stornieren statt als Waise stehen zu lassen
    await supabase.from(view).update({ status: "cancelled" }).eq("id", existing.id);
    return { status: "conflict", reason: "mismatch" };
  }

  const rpc = isEvent ? "checkout_create_event_booking" : "checkout_create_catering_order";
  const { error } = await supabase.rpc(rpc, { payload: a.payload });
  if (!error) return { status: "created", orderId: a.orderId };

  // Gleichzeitige Anfrage mit derselben Nummer: UNIQUE-Verletzung -> neu nachschlagen, nie freigeben/stornieren
  if (error.code === "23505" || String(error.message ?? "").toLowerCase().includes("duplicate key")) {
    const winner = await lookup();
    if (winner && winner.payment_status !== "paid" && matchesExisting(winner, a.quote, a.input)) return { status: "resumed", orderId: winner.id };
    return { status: "conflict", reason: "race" };
  }
  return { status: "failed", message: String(error.message ?? "rpc_failed"), code: error.code };
}

/** Stripe-Idempotenzschlüssel: dieselbe Bestellung (Nummer, Betrag, Korb) im selben 25-Minuten-Fenster ergibt dieselbe Session, nie zwei offene. */
export function stripeIdempotencyKey(orderNumber: string, totalCents: number, giftOrderId: string | null, now = Date.now()): string {
  return `cat-${orderNumber}-${totalCents}-${giftOrderId ?? "nogift"}-${Math.floor(now / (25 * 60_000))}`;
}
