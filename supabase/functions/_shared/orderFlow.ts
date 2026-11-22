// Bestellung anlegen oder fortsetzen (Abdichtung, B1/B2): gekapselt, damit die Handler-Logik ohne Stripe/HTTP testbar ist.
// Ergebnis ist immer eines von: created | resumed | conflict | failed.
//  * resumed: dieselbe Nummer gibt es schon, ist unbezahlt und stimmt in E-Mail, Betrag, Positionen, Termin, Adresse und Lieferart
//    überein (Fingerabdruck) -> weiterverwenden (z. B. nach einem Stripe-Fehler).
//  * conflict/mismatch: Nummer gibt es, aber mit anderem Inhalt -> die alte UNBEZAHLTE Zeile wird storniert (keine Waise), der
//    Aufrufer gibt den alten Korb-Hold frei und der Kunde bekommt eine neue Nummer.
//  * conflict/foreign: Nummer gehört zu einer ANDEREN E-Mail -> nichts anfassen (nie fremde Bestellungen stornieren), nur order_exists.
//  * conflict/paid: schon bezahlt -> nichts anfassen.
//  * conflict/race: gleichzeitige Anfrage derselben Nummer hat die Zeile angelegt (UNIQUE 23505) und ist noch in Arbeit -> NICHTS
//    freigeben oder stornieren (die andere Anfrage hält Korb und Stripe-Session).
import type { OrderQuote } from "./orderQuote.ts";
import type { CreateInput } from "./orderCreate.ts";

// deno-lint-ignore no-explicit-any
type Supa = any;

export type EnsureResult =
  | { status: "created" | "resumed"; orderId: string }
  | { status: "conflict"; reason: "mismatch" | "paid" | "race" | "foreign" }
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
    // Fremde Bestellung (andere E-Mail): nichts anfassen, auch nicht stornieren
    if (norm(existing.customer_email) !== norm(a.input.customer.email)) return { status: "conflict", reason: "foreign" };
    if (matchesExisting(existing, a.quote, a.input)) {
      await refreshResumedOrder(supabase, a, existing.id);
      return { status: "resumed", orderId: existing.id };
    }
    // Gleiche E-Mail, anderer Inhalt: unbezahlte Zeile stornieren statt als Waise stehen zu lassen. Nur wenn sie weiterhin unbezahlt
    // und nicht schon storniert ist; das Update-Ergebnis zählt (0 Zeilen = jemand war schneller -> neu bewerten).
    const { data: cancelled } = await supabase.from(view).update({ status: "cancelled" })
      .eq("id", existing.id).neq("payment_status", "paid").neq("status", "cancelled").select("id");
    if (!cancelled || cancelled.length === 0) {
      const again = await lookup();
      if (again?.payment_status === "paid") return { status: "conflict", reason: "paid" };
      return { status: "conflict", reason: "race" };
    }
    return { status: "conflict", reason: "mismatch" };
  }

  const rpc = isEvent ? "checkout_create_event_booking" : "checkout_create_catering_order";
  const { error } = await supabase.rpc(rpc, { payload: a.payload });
  if (!error) return { status: "created", orderId: a.orderId };

  // Gleichzeitige Anfrage mit derselben Nummer: UNIQUE-Verletzung -> neu nachschlagen, nie freigeben/stornieren
  if (error.code === "23505" || String(error.message ?? "").toLowerCase().includes("duplicate key")) {
    const winner = await lookup();
    if (winner && winner.payment_status !== "paid" && matchesExisting(winner, a.quote, a.input)) {
      await refreshResumedOrder(supabase, a, winner.id);
      return { status: "resumed", orderId: winner.id };
    }
    return { status: "conflict", reason: "race" };
  }
  return { status: "failed", message: String(error.message ?? "rpc_failed"), code: error.code };
}

/**
 * Beim Fortsetzen die Felder aktualisieren, die NICHT zum Fingerabdruck gehören (Name, Telefon, Firma, Notizen, Rechnungsadresse,
 * Stockwerk/Aufzug, Lieferadresstext), damit die Bestellung den letzten Stand des Kunden trägt. Best effort: ein Fehler hier verhindert
 * das Fortsetzen nicht (Betrag/Positionen/Termin/Adresse/Lieferart sind schon geprüft). Zahlart und Referenznummer stehen nicht in der
 * Ansicht und werden mit der Stripe-Session (Metadaten) geführt.
 */
async function refreshResumedOrder(supabase: Supa, a: { quote: OrderQuote; input: CreateInput; payload: Record<string, unknown> }, rowId: string): Promise<void> {
  const p = a.payload;
  try {
    if (a.quote.kind === "event") {
      await supabase.from("event_bookings").update({ internal_notes: p.internal_notes ?? null }).eq("id", rowId);
    } else {
      await supabase.from("catering_orders").update({
        delivery_address: p.delivery_address ?? null, notes: p.notes ?? null, delivery_floor: p.delivery_floor ?? null,
        has_elevator: p.has_elevator ?? false, billing_name: p.billing_name ?? null, billing_street: p.billing_street ?? null,
        billing_zip: p.billing_zip ?? null, billing_city: p.billing_city ?? null, billing_country: p.billing_country ?? null,
      }).eq("id", rowId);
    }
    // Kunde: passenden Datensatz (E-Mail + Name) suchen/anlegen wie der Insert-Trigger und der Bestellung zuordnen
    const c = a.input.customer;
    const { data: found } = await supabase.from("v2_customers").select("id").ilike("email", c.email).ilike("name", c.name).limit(1).maybeSingle();
    let customerId: string | null = found?.id ?? null;
    if (!customerId) {
      const { data: created } = await supabase.from("v2_customers").insert({ name: c.name, email: c.email, phone: c.phone, company: c.company || null }).select("id").maybeSingle();
      customerId = created?.id ?? null;
    } else {
      await supabase.from("v2_customers").update({ phone: c.phone, company: c.company || null }).eq("id", customerId);
    }
    if (customerId) await supabase.from("v2_events").update({ customer_id: customerId }).eq("id", rowId);
  } catch {
    /* best effort */
  }
}
