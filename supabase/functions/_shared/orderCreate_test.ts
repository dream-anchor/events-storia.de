// deno test supabase/functions/_shared/orderCreate_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildCateringPayload, buildEventPayload, parseCreateInput } from "./orderCreate.ts";
import { buildOrderQuote, type OrderQuote } from "./orderQuote.ts";
import type { Catalog } from "./cateringPricing.ts";

const catalog: Catalog = {
  a: { price: 30, active: true, menuSlug: "buffet-platten", name: "Lasagne", nameEn: "Lasagna" },
  pz: { price: 10, active: true, menuSlug: "pizze-napoletane", name: "Margherita", nameEn: "Margherita" },
};
const packages = {
  pp: { id: "pp", name: "Pro Person", name_en: "Per person", price: 50, price_per_person: true, is_active: true, min_guests: null, max_guests: null },
  flat: { id: "flat", name: "Pauschal", name_en: null, price: 500, price_per_person: false, is_active: true, min_guests: null, max_guests: null },
};
const quoteOf = (r: ReturnType<typeof buildOrderQuote>): OrderQuote => { assert(r.ok); return r.quote; };

const body = (over: Record<string, unknown> = {}) => ({
  orderNumber: "CAT-BESTELLUNG-22-11-2026-345",
  customer: { name: " Max Muster ", email: "Max@Example.com", phone: "0891234", company: "" },
  address: { street: "Teststr. 1", zip: "80333", city: "München", floor: "2", hasElevator: true },
  deliveryAddressText: "Teststr. 1\n80333 München\nStockwerk: 2",
  date: "2026-12-01", time: "12:00", notes: "bitte klingeln",
  billing: { name: "Muster GmbH", street: "Weg 2", zip: "80331", city: "München", country: "Deutschland" },
  referenceNumber: "PO-1", paymentMethod: "stripe",
  ...over,
});

Deno.test("Eingaben: bereinigt, E-Mail klein, Zahlart nur stripe/billie", () => {
  const r = parseCreateInput(body(), "catering");
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.input.customer.name, "Max Muster");
    assertEquals(r.input.customer.email, "max@example.com");
  }
  assertEquals(parseCreateInput(body({ paymentMethod: "invoice" }), "catering"), { ok: false, code: "payment_method_invalid" });
  assertEquals(parseCreateInput(body({ paymentMethod: "paid" }), "catering"), { ok: false, code: "payment_method_invalid" });
});

Deno.test("Eingaben: ungültige Kundendaten, Bestellnummer und Termin", () => {
  assertEquals(parseCreateInput(body({ customer: { name: "", email: "x@y.de", phone: "1" } }), "catering"), { ok: false, code: "customer_invalid" });
  assertEquals(parseCreateInput(body({ customer: { name: "A", email: "kein-mail", phone: "1" } }), "catering"), { ok: false, code: "customer_invalid" });
  assertEquals(parseCreateInput(body({ orderNumber: "EVT-BUCHUNG-22-11-2026-345" }), "catering"), { ok: false, code: "order_number_invalid" });
  assertEquals(parseCreateInput(body({ orderNumber: "CAT-BESTELLUNG-22-11-2026-345" }), "event"), { ok: false, code: "order_number_invalid" });
  assertEquals(parseCreateInput(body({ date: "morgen" }), "catering"), { ok: false, code: "invalid_request" });
});

Deno.test("Catering-Nutzlast: Server-Positionen, einfache Strecke, Beträge in EUR, user_id nur vom Server", () => {
  const q = quoteOf(buildOrderQuote({ items: [{ id: "a", quantity: 12, price: 1 }], chafingQuantity: 0, isPickup: false }, { catalog, packages, oneWayKm: 12.34 }));
  const p = parseCreateInput(body(), "catering");
  assert(p.ok);
  if (!p.ok) return;
  const payload = buildCateringPayload(q, p.input, "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222");
  assertEquals(payload.calculated_distance_km, 12.34); // NICHT 24,68
  assertEquals(payload.delivery_cost, 154.25);
  assertEquals(payload.minimum_order_surcharge, 0);
  assertEquals(payload.total_amount, 514.25);
  assertEquals(payload.items, [{ id: "a", name: "Lasagne", name_en: "Lasagna", quantity: 12, price: 30 }]); // Katalogpreis statt Browserpreis 1
  assertEquals(payload.user_id, "22222222-2222-2222-2222-222222222222");
  assertEquals(payload.payment_status, "pending");
  assertEquals(payload.is_pickup, false);
  assertEquals(payload.delivery_street, "Teststr. 1");
});

Deno.test("Catering-Nutzlast Abholung: keine Lieferdaten, keine Entfernung", () => {
  const q = quoteOf(buildOrderQuote({ items: [{ id: "a", quantity: 12 }], chafingQuantity: 0, isPickup: true }, { catalog, packages, oneWayKm: null }));
  const p = parseCreateInput(body(), "catering");
  assert(p.ok);
  if (!p.ok) return;
  const payload = buildCateringPayload(q, p.input, "id", null);
  assertEquals([payload.is_pickup, payload.delivery_street, payload.delivery_address, payload.calculated_distance_km, payload.delivery_cost], [true, null, null, null, 0]);
  assertEquals(payload.user_id, null);
});

Deno.test("Pizza-only: gleiche einfache Strecke, nur andere Gebühr (Fahrtenzahl steckt nicht in der Strecke)", () => {
  const pizza = quoteOf(buildOrderQuote({ items: [{ id: "pz", quantity: 10 }], chafingQuantity: 0, isPickup: false }, { catalog, packages, oneWayKm: 12.34 }));
  const p = parseCreateInput(body(), "catering");
  assert(p.ok);
  if (!p.ok) return;
  const payload = buildCateringPayload(pizza, p.input, "id", null);
  assertEquals(payload.calculated_distance_km, 12.34);
  assertEquals(payload.delivery_cost, 77.12);
});

Deno.test("Event-Nutzlast: mehrere Pakete = Summe, erstes Paket als package_id, alle in der Notiz; Status wird serverseitig offen gesetzt", () => {
  const q = quoteOf(buildOrderQuote({ items: [{ id: "event-pp", quantity: 20 }, { id: "event-flat", quantity: 10 }], chafingQuantity: 0, isPickup: false }, { catalog, packages, oneWayKm: null }));
  const p = parseCreateInput(body({ orderNumber: "EVT-BUCHUNG-22-11-2026-345" }), "event");
  assert(p.ok);
  if (!p.ok) return;
  const payload = buildEventPayload(q, p.input, "id");
  assertEquals(payload.total_amount, 1500);
  assertEquals(payload.package_id, "pp");
  assertEquals(payload.guest_count, 20);
  assert(String(payload.internal_notes).includes("Pauschal"));
  assertEquals(payload.status, "menu_pending");
  assertEquals(payload.payment_status, "pending");
});

Deno.test("Event-Nutzlast: ein Paket ohne Zusatznotiz", () => {
  const q = quoteOf(buildOrderQuote({ items: [{ id: "event-pp", quantity: 20 }], chafingQuantity: 0, isPickup: false }, { catalog, packages, oneWayKm: null }));
  const p = parseCreateInput(body({ orderNumber: "EVT-BUCHUNG-22-11-2026-345", notes: "" }), "event");
  assert(p.ok);
  if (!p.ok) return;
  assertEquals(buildEventPayload(q, p.input, "id").internal_notes, null);
});
