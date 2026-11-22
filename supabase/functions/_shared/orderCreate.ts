// Bestellung anlegen (Einheit I3, Abdichtung): reine Funktionen, die aus dem Server-Angebot (orderQuote.ts) und den
// Kundendaten die RPC-Nutzlast bauen. Beträge, Positionsnamen, Entfernung und Status stammen NIE aus dem Browser.
// Die Funktion create-catering-payment ruft damit checkout_create_catering_order / checkout_create_event_booking
// mit service_role auf; anon/authenticated haben dort seit der Sperr-Migration (20261122110000) keinen Zugriff mehr.
import type { OrderQuote } from "./orderQuote.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CATERING_ORDER_NUMBER_RE = /^CAT-BESTELLUNG-\d{2}-\d{2}-\d{4}-\d{3,4}$/;
export const EVENT_BOOKING_NUMBER_RE = /^EVT-BUCHUNG-\d{2}-\d{2}-\d{4}-\d{3,4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const orNull = (s: string): string | null => (s === "" ? null : s);

export interface CustomerInput { name: string; email: string; phone: string; company: string }
export interface AddressInput { street: string; zip: string; city: string; floor: string; hasElevator: boolean }
export interface BillingInput { name: string; street: string; zip: string; city: string; country: string }

export interface CreateInput {
  orderNumber: string;
  customer: CustomerInput;
  address: AddressInput;
  /** vom Checkout zusammengesetzter Adresstext (Straße, PLZ Ort, Stockwerk, Aufzug) */
  deliveryAddressText: string | null;
  date: string;
  time: string;
  notes: string;
  billing: BillingInput;
  referenceNumber: string;
  paymentMethod: "stripe" | "billie";
}

export type ParseResult = { ok: true; input: CreateInput } | { ok: false; code: "customer_invalid" | "order_number_invalid" | "invalid_request" | "payment_method_invalid" };

/** Liest und begrenzt die Eingaben des Browsers (Längen, Formate). Preise kommen hier nicht vor. */
export function parseCreateInput(body: Record<string, unknown>, kind: OrderQuote["kind"]): ParseResult {
  const c = (body.customer ?? {}) as Record<string, unknown>;
  const a = (body.address ?? {}) as Record<string, unknown>;
  const b = (body.billing ?? {}) as Record<string, unknown>;
  const customer: CustomerInput = {
    name: clean(c.name, 200), email: clean(c.email, 254).toLowerCase(), phone: clean(c.phone, 60), company: clean(c.company, 200),
  };
  if (!customer.name || !EMAIL_RE.test(customer.email) || !customer.phone) return { ok: false, code: "customer_invalid" };

  const orderNumber = clean(body.orderNumber, 60);
  const re = kind === "event" ? EVENT_BOOKING_NUMBER_RE : CATERING_ORDER_NUMBER_RE;
  if (!re.test(orderNumber)) return { ok: false, code: "order_number_invalid" };

  const date = clean(body.date, 10);
  const time = clean(body.time, 5);
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return { ok: false, code: "invalid_request" };

  const paymentMethod = body.paymentMethod;
  if (paymentMethod !== "stripe" && paymentMethod !== "billie") return { ok: false, code: "payment_method_invalid" };

  return {
    ok: true,
    input: {
      orderNumber,
      customer,
      address: { street: clean(a.street, 200), zip: clean(a.zip, 20), city: clean(a.city, 120), floor: clean(a.floor, 60), hasElevator: a.hasElevator === true },
      deliveryAddressText: orNull(clean(body.deliveryAddressText, 600)),
      date,
      time,
      notes: clean(body.notes, 2000),
      billing: { name: clean(b.name, 200), street: clean(b.street, 200), zip: clean(b.zip, 20), city: clean(b.city, 120), country: clean(b.country, 80) },
      referenceNumber: clean(body.referenceNumber, 100),
      paymentMethod,
    },
  };
}

const euro = (cents: number): number => cents / 100;

/** Nutzlast für checkout_create_catering_order. Zahlstatus 'pending' legt der Server fest (die Ansicht leitet ihn ohnehin aus v2_payments ab). */
export function buildCateringPayload(quote: OrderQuote, input: CreateInput, orderId: string, userId: string | null): Record<string, unknown> {
  const delivery = !quote.isPickup;
  return {
    id: orderId,
    order_number: input.orderNumber,
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    customer_phone: input.customer.phone,
    company_name: orNull(input.customer.company),
    delivery_street: delivery ? orNull(input.address.street) : null,
    delivery_zip: delivery ? orNull(input.address.zip) : null,
    delivery_city: delivery ? orNull(input.address.city) : null,
    delivery_floor: delivery ? orNull(input.address.floor) : null,
    has_elevator: delivery ? input.address.hasElevator : false,
    delivery_address: delivery ? input.deliveryAddressText : null,
    is_pickup: quote.isPickup,
    desired_date: input.date,
    desired_time: input.time,
    notes: orNull(input.notes),
    // Server-Positionen: Namen und Einzelpreise aus dem Katalog (Chafing: Festpreis)
    items: quote.lines.map((l) => ({ id: l.id, name: l.name, name_en: l.name_en, quantity: l.quantity, price: euro(l.unitCents) })),
    total_amount: euro(quote.totalCents),
    billing_name: orNull(input.billing.name),
    billing_street: orNull(input.billing.street),
    billing_zip: orNull(input.billing.zip),
    billing_city: orNull(input.billing.city),
    billing_country: orNull(input.billing.country),
    delivery_cost: euro(quote.deliveryCents),
    minimum_order_surcharge: euro(quote.surchargeCents),
    // EINFACHE Strecke in km (0,01 genau). Fahrtenzahl: Pizza-only 1, sonst 2 (nicht in der Strecke enthalten).
    calculated_distance_km: quote.delivery?.oneWayDistanceKm ?? null,
    payment_method: input.paymentMethod,
    user_id: userId,
    reference_number: orNull(input.referenceNumber),
    payment_status: "pending",
  };
}

/** Anzeigetext der gebuchten Pakete für die interne Notiz (eine Buchung kann mehrere Pakete enthalten). */
export function packagesNote(quote: OrderQuote): string {
  return quote.lines.map((l) => `${l.quantity} Gäste · ${l.name} · ${(l.lineCents / 100).toFixed(2).replace(".", ",")} €`).join("\n");
}

/**
 * Nutzlast für checkout_create_event_booking. Mehrere Pakete je Buchung werden einzeln nachgerechnet und summiert
 * (total_amount = Summe); package_id/guest_count der Buchung = erstes Paket, alle Pakete stehen in der internen Notiz.
 */
export function buildEventPayload(quote: OrderQuote, input: CreateInput, orderId: string): Record<string, unknown> {
  const first = quote.lines[0];
  const notes = [input.notes, quote.lines.length > 1 ? `Gebuchte Pakete:\n${packagesNote(quote)}` : ""].filter((s) => s !== "").join("\n\n");
  return {
    id: orderId,
    booking_number: input.orderNumber,
    customer_name: input.customer.name,
    customer_email: input.customer.email,
    phone: input.customer.phone,
    company_name: orNull(input.customer.company),
    event_date: input.date,
    event_time: input.time,
    guest_count: first.quantity,
    package_id: first.id.replace(/^event-/, ""),
    total_amount: euro(quote.totalCents),
    internal_notes: orNull(notes),
    menu_selection: null,
    // Server legt fest: noch unbezahlt. Die RPC der Sperr-Migration ignoriert diese Felder ohnehin und setzt sie selbst;
    // die bisherige RPC machte aus dem Standardwert 'confirmed' sofort den v2-Status 'paid'.
    status: "menu_pending",
    payment_status: "pending",
  };
}
