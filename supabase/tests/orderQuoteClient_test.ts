// deno test supabase/tests/orderQuoteClient_test.ts
// Client-Seite der Abdichtung: Warenkorb-Abgleich mit dem Server-Angebot, Anfrage-Schlüssel, Lieferanzeige, Event-Preis bei Gästezahl-Änderung.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  type CartLineLike, type OrderQuote, type QuoteLine,
  deliveryCalcFromQuote, describeCartChanges, hasCartSync, quoteRequestKey, reconcileCartWithQuote, totalChanged,
} from "../../src/lib/orderQuote.ts";
import { LOCATION_PACKAGE_ID, calculateEventPackagePrice, clampEventGuests, eventUnitPriceForGuests } from "../../src/lib/eventPricing.ts";

const line = (over: Partial<QuoteLine> & { id: string }): QuoteLine => ({
  name: "Lasagne", name_en: "Lasagna", quantity: 10, unitCents: 3000, lineCents: 30000, kind: "menu", priceChanged: false, nameChanged: false, ...over,
});
const quote = (over: Partial<OrderQuote> = {}): OrderQuote => ({
  kind: "catering", isPickup: true, isPizzaOnly: false, lines: [line({ id: "a" })], issues: [], itemsCents: 30000, checkoutChafingCents: 0,
  surchargeCents: 0, deliveryCents: 0, totalCents: 30000, delivery: null, ...over,
});
const cart = (over: Partial<CartLineLike> & { id: string }): CartLineLike => ({ name: "Lasagne", name_en: "Lasagna", price: 30, quantity: 10, ...over });
const fmt = (v: number) => `${v.toFixed(2)} EUR`;

Deno.test("Abgleich: unveränderter Warenkorb bleibt unangetastet (kein Hinweis, kein Schreibzugriff)", () => {
  const s = reconcileCartWithQuote([cart({ id: "a" })], quote());
  assertEquals(hasCartSync(s), false);
  assertEquals(s.changes, []);
});

Deno.test("Abgleich: Preis im Admin geändert => Warenkorb übernimmt den Serverpreis, Kunde wird informiert", () => {
  const s = reconcileCartWithQuote([cart({ id: "a", price: 25 })], quote());
  assertEquals(s.updates.map((u) => [u.id, u.price]), [["a", 30]]);
  assertEquals(s.changes[0].kind, "price");
  assertEquals(describeCartChanges(s.changes, "de", fmt), ["Lasagne: Preis geändert (25.00 EUR → 30.00 EUR)"]);
  assertEquals(describeCartChanges(s.changes, "en", fmt), ["Lasagne: price changed (25.00 EUR → 30.00 EUR)"]);
});

Deno.test("Abgleich: Name geändert => übernommen; leerer name_en gilt wie null (kein falscher Alarm)", () => {
  const renamed = reconcileCartWithQuote([cart({ id: "a", name: "Lasagne alt" })], quote());
  assertEquals(renamed.changes[0].kind, "name");
  assertEquals(renamed.updates[0].name, "Lasagne");
  const noFalseAlarm = reconcileCartWithQuote([cart({ id: "x", name_en: "" })], quote({ lines: [line({ id: "x", name_en: null })] }));
  assertEquals(noFalseAlarm.changes, []);
});

Deno.test("Abgleich: entfernter/nicht verfügbarer Artikel wird aus dem Warenkorb genommen", () => {
  const s = reconcileCartWithQuote([cart({ id: "a" }), cart({ id: "gone", name: "Alt" })], quote({ issues: [{ code: "item_unavailable", id: "gone", name: "Alt" }] }));
  assertEquals(s.removals, ["gone"]);
  assertEquals(describeCartChanges(s.changes, "de", fmt), ["Alt: nicht mehr verfügbar und aus dem Warenkorb entfernt"]);
});

Deno.test("Abgleich: Gästezahl außerhalb der Grenzen wird begrenzt", () => {
  const s = reconcileCartWithQuote([cart({ id: "event-p", name: "Paket", quantity: 80 })], quote({
    kind: "event", lines: [], issues: [{ code: "guests_out_of_range", id: "event-p", name: "Paket", minGuests: 10, maxGuests: 50 }],
  }));
  assertEquals(s.clamps, [{ id: "event-p", quantity: 50 }]);
  assertEquals(s.removals, []);
});

Deno.test("Abgleich: Event-Paket mit altem Durchschnittspreis bekommt Serverbetrag und Preisgrundlage", () => {
  const ep = { basePrice: 8500, pricePerPerson: false, minGuests: 1, maxGuests: 200 };
  const ev = line({ id: "event-loc", name: "Gesamte Location", name_en: "Whole venue", quantity: 80, unitCents: 12143, lineCents: 971429, kind: "event_package", eventPricing: ep });
  const s = reconcileCartWithQuote([cart({ id: "event-loc", name: "Gesamte Location", name_en: "Whole venue", quantity: 80, price: 8500 / 60 })], quote({ kind: "event", lines: [ev], totalCents: 971429 }));
  assertEquals(s.updates.length, 1);
  assertEquals(Math.round(s.updates[0].price * 80 * 100), 971429);
  assertEquals(s.updates[0].eventPricing, ep);
  // stimmen Betrag und Grundlage schon, bleibt es still
  const quiet = reconcileCartWithQuote([cart({ id: "event-loc", name: "Gesamte Location", name_en: "Whole venue", quantity: 80, price: 971429 / 80 / 100, eventPricing: ep })], quote({ kind: "event", lines: [ev] }));
  assertEquals(hasCartSync(quiet), false);
});

Deno.test("Checkout-Chafing (Zustand) wird nicht gegen den Warenkorb abgeglichen", () => {
  const s = reconcileCartWithQuote([cart({ id: "a" })], quote({ lines: [line({ id: "a" }), line({ id: "chafing-dish", kind: "chafing_checkout", quantity: 2, unitCents: 2500, lineCents: 5000 })] }));
  assertEquals(hasCartSync(s), false);
});

Deno.test("Betragsänderung wird erkannt", () => {
  assert(totalChanged(quote({ totalCents: 100 }), quote({ totalCents: 101 })));
  assert(!totalChanged(quote({ totalCents: 100 }), quote({ totalCents: 100 })));
  assert(!totalChanged(null, quote()));
});

Deno.test("Anfrage-Schlüssel: nur IDs, Mengen, Lieferart, Adresse (Reihenfolge und Schreibweise egal, Preise nie)", () => {
  const base = { chafingQuantity: 0, deliveryType: "delivery", address: { street: "Teststr. 1", zip: "80333", city: "München" } };
  const a = quoteRequestKey({ ...base, items: [{ id: "a", quantity: 1 }, { id: "b", quantity: 2 }] });
  const b = quoteRequestKey({ ...base, items: [{ id: "b", quantity: 2 }, { id: "a", quantity: 1 }], address: { street: " teststr. 1", zip: "80333", city: "münchen " } });
  assertEquals(a, b);
  assert(a !== quoteRequestKey({ ...base, items: [{ id: "a", quantity: 2 }, { id: "b", quantity: 2 }] }));
  // Abholung: Adresse spielt keine Rolle
  assertEquals(
    quoteRequestKey({ ...base, deliveryType: "pickup", items: [{ id: "a", quantity: 1 }] }),
    quoteRequestKey({ ...base, deliveryType: "pickup", address: { street: "x", zip: "y", city: "z" }, items: [{ id: "a", quantity: 1 }] }),
  );
});

Deno.test("Lieferanzeige aus dem Angebot: einfache Strecke, Fahrten, Texte", () => {
  const d = (trips: 0 | 1 | 2, km: number) => deliveryCalcFromQuote(quote({
    isPickup: false,
    delivery: { oneWayDistanceKm: km, trips, isFreeDelivery: trips === 0, isRoundTrip: trips === 2, deliveryCostNet: 129.62, deliveryCostGross: 154.25, deliveryVat: 24.63, deliveryVatRate: 0.19, minimumOrder: 200 },
  }));
  const far = d(2, 12.34);
  assertEquals([far?.distanceKm, far?.oneWayDistanceKm, far?.isRoundTrip], [12.34, 12.34, true]); // distanceKm = einfache Strecke, nicht 24,68
  assertEquals(far?.message, "Lieferung (12 km × 2 Fahrten, inkl. Anfahrtspauschale)");
  assertEquals(d(1, 12.34)?.messageEn, "Delivery (12 km, incl. base fee)");
  assertEquals(d(0, 0.9)?.message, "Kostenlose Lieferung");
  assertEquals(deliveryCalcFromQuote(quote()), null);
});

Deno.test("Event-Preis bei Gästezahl-Änderung: Warenkorb rechnet über calculateEventPackagePrice neu", () => {
  const loc = { basePrice: 8500, pricePerPerson: false, minGuests: 1, maxGuests: 200 };
  const total = (guests: number) => eventUnitPriceForGuests(LOCATION_PACKAGE_ID, loc, guests) * guests;
  for (const g of [20, 60, 70, 71, 80, 120]) {
    assertEquals(Math.round(total(g) * 100), Math.round(calculateEventPackagePrice(LOCATION_PACKAGE_ID, 8500, g, false) * 100), `Location ${g} Gäste`);
  }
  // Pauschalpaket: der Gesamtbetrag bleibt bei jeder Gästezahl gleich (früher: Stückpreis = Betrag/Gäste beim Hinzufügen, danach falsch)
  const flat = { basePrice: 500, pricePerPerson: false, minGuests: 1, maxGuests: 200 };
  assertEquals(Math.round(eventUnitPriceForGuests("flat", flat, 10) * 10 * 100), 50000);
  assertEquals(Math.round(eventUnitPriceForGuests("flat", flat, 40) * 40 * 100), 50000);
  const pp = { basePrice: 50, pricePerPerson: true, minGuests: 10, maxGuests: 50 };
  assertEquals(eventUnitPriceForGuests("pp", pp, 33) * 33, 1650);
  assertEquals([clampEventGuests(5, pp), clampEventGuests(33, pp), clampEventGuests(99, pp)], [10, 33, 50]);
});

import { distanceNote, distanceSemantics } from "../../src/lib/orderQuote.ts";
Deno.test("A7: Bedeutung der gespeicherten Strecke aus den Daten, nicht aus dem Datum", () => {
  assertEquals(distanceSemantics(12.34, 154.25), "single");      // neu: einfache Strecke, 2 Fahrten
  assertEquals(distanceSemantics(12.34, 77.12), "single");       // Pizza-only
  assertEquals(distanceSemantics(24.68, 154.25), "legacy_total"); // Alt: Strecke x 2 gespeichert, Gebühr für 12,34 km
  assertEquals(distanceSemantics(5, 119), "single");
  assertEquals(distanceSemantics(0.9, 0), "single");
  assertEquals(distanceSemantics(12.3, 154.13), "single"); // 0,1-km-Rundung des alten Checkouts bleibt tolerant
  assertEquals(distanceSemantics(null, 10), "unknown");
  assertEquals(distanceNote(12.34, 154.25), " (einfache Strecke)");
  assertEquals(distanceNote(24.68, 154.25), " (Altbestellung: Strecke × Fahrten)");
  assertEquals(distanceNote(40, 5), "");
});

Deno.test("Anfrage-Schlüssel: Körbe ändern den Schlüssel (Aufschlag hängt vom Korbwert ab), ohne Körbe bleibt er wie bisher", () => {
  const p = { items: [{ id: "a", quantity: 2 }], chafingQuantity: 0, deliveryType: "delivery", address: { street: "S", zip: "80333", city: "M" } };
  const none = quoteRequestKey(p);
  assertEquals(quoteRequestKey({ ...p, giftItems: [] }), none);
  const v1 = "11111111-1111-4111-8111-111111111111";
  const withGift = quoteRequestKey({ ...p, giftItems: [{ variant_id: v1, qty: 1 }] });
  assert(withGift !== none);
  assert(withGift !== quoteRequestKey({ ...p, giftItems: [{ variant_id: v1, qty: 2 }] }));
  // Reihenfolge egal
  const v2 = "22222222-2222-4222-8222-222222222222";
  assertEquals(
    quoteRequestKey({ ...p, giftItems: [{ variant_id: v1, qty: 1 }, { variant_id: v2, qty: 1 }] }),
    quoteRequestKey({ ...p, giftItems: [{ variant_id: v2, qty: 1 }, { variant_id: v1, qty: 1 }] }),
  );
});
