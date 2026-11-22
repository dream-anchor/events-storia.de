// deno test supabase/functions/_shared/orderQuote_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import type { Catalog } from "./cateringPricing.ts";
import { LOCATION_PACKAGE_ID } from "./eventPricing.ts";
import { ORDER_MESSAGES, buildOrderQuote, quoteHasChanges, type OrderQuote, type QuoteContext, type QuotePackage, type QuoteRequest } from "./orderQuote.ts";

const catalog: Catalog = {
  a: { price: 30, active: true, menuSlug: "buffet-platten", name: "Lasagne", nameEn: "Lasagna" },
  b: { price: 8.5, active: true, menuSlug: "buffet-platten", name: "Tiramisu", nameEn: "Tiramisu" },
  pz: { price: 10, active: true, menuSlug: "pizze-napoletane", name: "Margherita", nameEn: "Margherita" },
  old: { price: 5, active: false, menuSlug: "buffet-platten", name: "Alt", nameEn: "Old" },
  free: { price: null, active: true, menuSlug: "buffet-platten", name: "Ohne Preis", nameEn: "No price" },
};
const pkg = (over: Partial<QuotePackage> & { id: string }): QuotePackage => ({
  name: "Paket", name_en: "Package", price: 50, price_per_person: true, is_active: true, min_guests: null, max_guests: null, ...over,
});
const packages: Record<string, QuotePackage> = {
  pp: pkg({ id: "pp", name: "Pro Person", price: 50, price_per_person: true }),
  flat: pkg({ id: "flat", name: "Pauschal", price: 500, price_per_person: false }),
  [LOCATION_PACKAGE_ID]: pkg({ id: LOCATION_PACKAGE_ID, name: "Gesamte Location", price: 8500, price_per_person: false }),
  off: pkg({ id: "off", is_active: false }),
  rng: pkg({ id: "rng", price: 50, price_per_person: true, min_guests: 10, max_guests: 50 }),
};
const ctx = (over: Partial<QuoteContext> = {}): QuoteContext => ({ catalog, packages, oneWayKm: null, ...over });
const req = (over: Partial<QuoteRequest> = {}): QuoteRequest => ({ items: [{ id: "a", quantity: 12 }], chafingQuantity: 0, isPickup: true, ...over });
const ok = (r: ReturnType<typeof buildOrderQuote>): OrderQuote => {
  assert(r.ok, `Angebot erwartet, erhalten ${JSON.stringify(r)}`);
  return r.quote;
};

Deno.test("Abholung: Positionen aus dem Katalog, keine Lieferung, kein Aufschlag", () => {
  const q = ok(buildOrderQuote(req(), ctx()));
  assertEquals(q.kind, "catering");
  assertEquals([q.itemsCents, q.surchargeCents, q.deliveryCents, q.totalCents], [36000, 0, 0, 36000]);
  assertEquals(q.delivery, null);
  assertEquals(q.lines[0].name, "Lasagne");
});

Deno.test("Browser-Preis ist nie Quelle: manipulierter Preis wird als geändert markiert, der Katalogpreis zählt", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "a", quantity: 10, price: 1 }] }), ctx()));
  assertEquals(q.totalCents, 30000);
  assertEquals(q.lines[0].priceChanged, true);
  assert(quoteHasChanges(q));
});

Deno.test("Unverändert: kein Änderungshinweis, wenn Preis und Name stimmen", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "a", quantity: 10, price: 30, name: "Lasagne", name_en: "Lasagna" }] }), ctx()));
  assertEquals(quoteHasChanges(q), false);
});

Deno.test("Namensänderung im Katalog wird gemeldet", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "a", quantity: 10, price: 30, name: "Lasagne alt" }] }), ctx()));
  assertEquals(q.lines[0].nameChanged, true);
});

Deno.test("Lieferung 5 km: 2 Fahrten, 119,00 EUR, Mindestwert 150 => Aufschlag", () => {
  const q = ok(buildOrderQuote(req({ isPickup: false, items: [{ id: "a", quantity: 4 }] }), ctx({ oneWayKm: 5 }))); // 120 EUR
  assertEquals(q.deliveryCents, 11900);
  assertEquals(q.surchargeCents, 3000);
  assertEquals(q.totalCents, 12000 + 3000 + 11900);
  assertEquals(q.delivery?.trips, 2);
  assertEquals(q.delivery?.minimumOrder, 150);
});

Deno.test("Echte Werte: 12 Lasagne, 12,34 km einfach => Gebühr 154,25, gespeicherte Strecke 12,34 (nicht 24,68)", () => {
  const q = ok(buildOrderQuote(req({ isPickup: false }), ctx({ oneWayKm: 12.34 })));
  assertEquals(q.delivery?.oneWayDistanceKm, 12.34);
  assertEquals(q.delivery?.trips, 2);
  assertEquals(q.deliveryCents, 15425);
  assertEquals(q.delivery?.deliveryCostNet, 129.62);
  assertEquals(q.surchargeCents, 0); // 360 >= 200
  assertEquals(q.totalCents, 36000 + 15425);
});

Deno.test("Entfernung wird auf 0,01 km gerundet, Gebühr folgt dem gerundeten Wert", () => {
  const q = ok(buildOrderQuote(req({ isPickup: false }), ctx({ oneWayKm: 12.3449 })));
  assertEquals(q.delivery?.oneWayDistanceKm, 12.34);
  assertEquals(q.deliveryCents, 15425);
});

Deno.test("Pizza-only: eine Fahrt, nur Hinfahrt", () => {
  const q = ok(buildOrderQuote(req({ isPickup: false, items: [{ id: "pz", quantity: 10 }] }), ctx({ oneWayKm: 12.34 })));
  assertEquals(q.isPizzaOnly, true);
  assertEquals(q.delivery?.trips, 1);
  assertEquals(q.deliveryCents, 7712);
  assertEquals(q.surchargeCents, 10000); // 100 < 200
  assertEquals(q.delivery?.isRoundTrip, false);
});

Deno.test("bis 1 km: kostenlos, Mindestwert 50 EUR", () => {
  const q = ok(buildOrderQuote(req({ isPickup: false, items: [{ id: "b", quantity: 4 }] }), ctx({ oneWayKm: 0.9 }))); // 34 EUR
  assertEquals(q.delivery?.isFreeDelivery, true);
  assertEquals(q.delivery?.trips, 0);
  assertEquals(q.deliveryCents, 0);
  assertEquals(q.surchargeCents, 1600);
});

Deno.test("Chafing im Checkout zählt nicht für den Mindestbestellwert, Warenkorb-Chafing schon (und ist nie Pizza-only)", () => {
  // 4 Tiramisu = 34 EUR; Checkout-Chafing 2 x 25 = 50: Aufschlag bei 5 km (150) = 150 - 34, nicht 150 - 84
  const q = ok(buildOrderQuote(req({ isPickup: false, items: [{ id: "b", quantity: 4 }], chafingQuantity: 2 }), ctx({ oneWayKm: 5 })));
  assertEquals(q.surchargeCents, 15000 - 3400);
  assertEquals(q.checkoutChafingCents, 5000);
  assertEquals(q.itemsCents, 3400 + 5000);
  const cart = ok(buildOrderQuote(req({ isPickup: false, items: [{ id: "pz", quantity: 10 }, { id: "chafing-dish", quantity: 1, price: 25 }] }), ctx({ oneWayKm: 5 })));
  assertEquals(cart.isPizzaOnly, false);
  assertEquals(cart.itemsCents, 10000 + 2500);
  const pizzaPlusCheckoutChafing = ok(buildOrderQuote(req({ isPickup: false, items: [{ id: "pz", quantity: 10 }], chafingQuantity: 1 }), ctx({ oneWayKm: 5 })));
  assertEquals(pizzaPlusCheckoutChafing.isPizzaOnly, true);
});

Deno.test("Lieferung ohne ermittelbare Entfernung: abgelehnt (nie ein geratener Preis)", () => {
  const r = buildOrderQuote(req({ isPickup: false }), ctx({ oneWayKm: null }));
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "delivery_unverifiable");
});

Deno.test("nicht mehr verfügbare Artikel: blockierender Befund, aus der Summe heraus", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "a", quantity: 1 }, { id: "old", quantity: 1 }, { id: "free", quantity: 1 }, { id: "nope", quantity: 1 }] }), ctx()));
  assertEquals(q.issues.map((i) => [i.id, i.code]), [["old", "item_unavailable"], ["free", "item_unavailable"], ["nope", "unknown_item"]]);
  assertEquals(q.totalCents, 3000);
  assert(quoteHasChanges(q));
});

Deno.test("ungültige Mengen und leere Warenkörbe werden abgelehnt", () => {
  for (const items of [[], [{ id: "a", quantity: 0 }], [{ id: "a", quantity: 1.5 }], [{ id: "a", quantity: 10001 }], [{ id: "", quantity: 1 }]]) {
    const r = buildOrderQuote(req({ items }), ctx());
    assert(!r.ok);
    if (!r.ok) assertEquals(r.code, "invalid_items");
  }
  assert(!buildOrderQuote(req({ chafingQuantity: -1 }), ctx()).ok);
});

Deno.test("Catering und Event-Paket gemischt: abgelehnt", () => {
  const r = buildOrderQuote(req({ items: [{ id: "a", quantity: 1 }, { id: "event-pp", quantity: 20 }] }), ctx());
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "mixed_cart");
});

Deno.test("Event: pro Person, Pauschale, Gesamte Location gestaffelt", () => {
  assertEquals(ok(buildOrderQuote(req({ items: [{ id: "event-pp", quantity: 20 }] }), ctx())).totalCents, 100000);
  assertEquals(ok(buildOrderQuote(req({ items: [{ id: "event-flat", quantity: 30 }] }), ctx())).totalCents, 50000);
  assertEquals(ok(buildOrderQuote(req({ items: [{ id: `event-${LOCATION_PACKAGE_ID}`, quantity: 60 }] }), ctx())).totalCents, 850000);
  assertEquals(ok(buildOrderQuote(req({ items: [{ id: `event-${LOCATION_PACKAGE_ID}`, quantity: 80 }] }), ctx())).totalCents, 971429);
});

Deno.test("Event: Gästezahl ändert den Betrag (Pauschale bleibt, Location staffelt) und der Server rechnet immer neu", () => {
  // der Browser kannte den Durchschnittspreis 8500/60 = 141,67 je Gast; bei 80 Gästen stimmt das nicht mehr
  const q = ok(buildOrderQuote(req({ items: [{ id: `event-${LOCATION_PACKAGE_ID}`, quantity: 80, price: 8500 / 60 }] }), ctx()));
  assertEquals(q.totalCents, 971429);
  assertEquals(q.lines[0].priceChanged, true);
});

Deno.test("Event: mehrere Pakete je Buchung werden einzeln nachgerechnet und summiert", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "event-pp", quantity: 20 }, { id: "event-flat", quantity: 10 }] }), ctx()));
  assertEquals(q.lines.map((l) => l.lineCents), [100000, 50000]);
  assertEquals(q.totalCents, 150000);
});

Deno.test("Event: inaktives/unbekanntes Paket und Gästegrenzen sind blockierende Befunde", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "event-off", quantity: 10 }, { id: "event-xx", quantity: 10 }, { id: "event-rng", quantity: 5 }, { id: "event-rng", quantity: 51 }, { id: "event-rng", quantity: 50 }] }), ctx()));
  assertEquals(q.issues.map((i) => i.code), ["unknown_package", "unknown_package", "guests_out_of_range", "guests_out_of_range"]);
  assertEquals(q.issues[2].minGuests, 10);
  assertEquals(q.issues[2].maxGuests, 50);
  assertEquals(q.totalCents, 250000); // nur die gültige Zeile (50 Gäste)
});

Deno.test("Event ohne max_guests: Standardobergrenze 200", () => {
  const q = ok(buildOrderQuote(req({ items: [{ id: "event-pp", quantity: 201 }] }), ctx()));
  assertEquals(q.issues.map((i) => i.code), ["guests_out_of_range"]);
});

Deno.test("Meldungen: jeder Fehlercode hat deutsche und englische Fassung", () => {
  for (const [code, m] of Object.entries(ORDER_MESSAGES)) {
    assert(m.de.length > 10 && m.en.length > 10, code);
    assert(m.de !== m.en, code);
  }
});
