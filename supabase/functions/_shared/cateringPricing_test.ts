// deno test supabase/functions/_shared/cateringPricing_test.ts
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  type Catalog,
  type ClientLine,
  deliveryFeeGrossCents,
  isPizzaOnlyOrder,
  minimumOrderCents,
  toCents,
  verifyCateringOrder,
  type VerifyInput,
} from "./cateringPricing.ts";

const catalog: Catalog = {
  a: { price: 12.9, active: true, menuSlug: "buffet-platten" },
  b: { price: 8.5, active: true, menuSlug: "buffet-platten" },
  pz: { price: 9.9, active: true, menuSlug: "pizze-napoletane" },
  old: { price: 5, active: false, menuSlug: "buffet-platten" },
  free: { price: null, active: true, menuSlug: "buffet-platten" },
};

function base(over: Partial<VerifyInput> = {}): VerifyInput {
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }, { id: "b", quantity: 4, price: 8.5 }]; // 129 + 34 = 163
  return { lines, catalog, isPickup: true, oneWayKm: null, clientDeliveryEuro: 0, clientSurchargeEuro: 0, clientTotalEuro: 163, ...over };
}

Deno.test("Abholung, korrekter Warenkorb: ok", () => {
  const r = verifyCateringOrder(base());
  assert(r.ok);
  if (r.ok) assertEquals(r.expectedTotalCents, 16300);
});

Deno.test("Manipulation: Client sendet zu niedrigen Einzelpreis", () => {
  const r = verifyCateringOrder(base({
    lines: [{ id: "a", quantity: 10, price: 1.29 }, { id: "b", quantity: 4, price: 8.5 }],
    clientTotalEuro: 47.9,
  }));
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "price_mismatch");
});

Deno.test("Manipulation: Positionspreise stimmen, Summe zu niedrig", () => {
  const r = verifyCateringOrder(base({ clientTotalEuro: 1 }));
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "total_mismatch");
});

Deno.test("Rundung: Abweichung 1 Cent ok, 2 Cent abgelehnt", () => {
  assert(verifyCateringOrder(base({ clientTotalEuro: 163.01 })).ok);
  const r = verifyCateringOrder(base({ clientTotalEuro: 163.02 }));
  assert(!r.ok);
});

Deno.test("Rundung: Gleitkomma-Preise (12,9 * 3) landen auf ganzen Cent", () => {
  const r = verifyCateringOrder(base({ lines: [{ id: "a", quantity: 3, price: 12.9 }], clientTotalEuro: 38.7 }));
  assert(r.ok);
  if (r.ok) assertEquals(r.itemsCents, 3870);
  assertEquals(toCents(0.1 + 0.2), 30);
});

Deno.test("Unbekannte, gelöschte und unbepreiste Positionen werden abgelehnt", () => {
  for (const [id, code] of [["zzz", "unknown_item"], ["old", "item_unavailable"], ["free", "item_unavailable"]] as const) {
    const r = verifyCateringOrder(base({ lines: [{ id, quantity: 4, price: 5 }], clientTotalEuro: 20 }));
    assert(!r.ok);
    if (!r.ok) assertEquals(r.code, code);
  }
});

Deno.test("Ungültige Mengen: 0, negativ, Bruch, leer", () => {
  for (const q of [0, -3, 1.5]) {
    const r = verifyCateringOrder(base({ lines: [{ id: "a", quantity: q, price: 12.9 }], clientTotalEuro: 0 }));
    assert(!r.ok);
    if (!r.ok) assertEquals(r.code, "invalid_items");
  }
  const e = verifyCateringOrder(base({ lines: [] }));
  assert(!e.ok);
});

Deno.test("Chafing Dish: Festpreis 25 EUR, manipulierter Preis abgelehnt", () => {
  const ok = verifyCateringOrder(base({
    lines: [{ id: "a", quantity: 10, price: 12.9 }, { id: "chafing-dish", quantity: 2, price: 25 }],
    clientTotalEuro: 179,
  }));
  assert(ok.ok);
  const bad = verifyCateringOrder(base({
    lines: [{ id: "a", quantity: 10, price: 12.9 }, { id: "chafing-dish", quantity: 2, price: 1 }],
    clientTotalEuro: 131,
  }));
  assert(!bad.ok);
});

Deno.test("Liefergebuehr: Stufen wie calculate-delivery (19 % MwSt., Hin- und Rueckfahrt)", () => {
  assertEquals(deliveryFeeGrossCents(0.8, false), 0); // <= 1 km frei
  assertEquals(deliveryFeeGrossCents(5, false), 11900); // 2 x 50 netto = 100 -> 119,00
  assertEquals(deliveryFeeGrossCents(5, true), 5950); // Pizza nur Hinfahrt: 50 -> 59,50
  assertEquals(deliveryFeeGrossCents(8, false), 11900); // 8 km noch Stufe 2
  // 12 km: (100 + 24 * 1,2) = 128,80 netto -> 153,272 -> 153,27
  assertEquals(deliveryFeeGrossCents(12, false), 15327);
  assertEquals(deliveryFeeGrossCents(12, true), 7664); // (50 + 14,4) = 64,40 * 1,19 = 76,636 -> 76,64
});

Deno.test("Mindestbestellwert je Entfernung: 50 / 150 / 200 EUR", () => {
  assertEquals(minimumOrderCents(1), 5000);
  assertEquals(minimumOrderCents(1.01), 15000);
  assertEquals(minimumOrderCents(8), 15000);
  assertEquals(minimumOrderCents(8.01), 20000);
});

Deno.test("Lieferung 5 km, Warenkorb unter Mindestwert: Aufschlag + Gebuehr", () => {
  // Warenkorb 100 EUR, Mindestbestellwert 150 => Aufschlag 50; Lieferung 119 => Summe 269
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }]; // 129 EUR
  const r = verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 5,
    clientDeliveryEuro: 119, clientSurchargeEuro: 21, clientTotalEuro: 129 + 21 + 119,
  });
  assert(r.ok);
  if (r.ok) assertEquals(r.expectedTotalCents, 26900);
});

Deno.test("Manipulation: Liefergebuehr 0 trotz 5 km, oder Aufschlag weggelassen", () => {
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }];
  const noFee = verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 5, clientDeliveryEuro: 0, clientSurchargeEuro: 21, clientTotalEuro: 150 });
  assert(!noFee.ok);
  if (!noFee.ok) assertEquals(noFee.code, "delivery_mismatch");
  const noSur = verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 5, clientDeliveryEuro: 119, clientSurchargeEuro: 0, clientTotalEuro: 248 });
  assert(!noSur.ok);
  if (!noSur.ok) assertEquals(noSur.code, "surcharge_mismatch");
});

Deno.test("Aufschlag mit/ohne Chafing-Basis (Client rechnet Checkout-Chafing nicht in den Warenkorb)", () => {
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }, { id: "chafing-dish", quantity: 1, price: 25 }]; // 154 gesamt
  // Basis ohne Chafing = 129 => Aufschlag 21; Basis mit Chafing = 154 => 0. Beides zulaessig.
  const mk = (sur: number) => verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 5, clientDeliveryEuro: 119, clientSurchargeEuro: sur, clientTotalEuro: 154 + sur + 119,
  });
  assert(mk(21).ok);
  assert(mk(0).ok);
  assert(!mk(10).ok);
});

Deno.test("Lieferung ohne ermittelbare Entfernung: nicht pruefbar (fail closed)", () => {
  const r = verifyCateringOrder(base({ isPickup: false, oneWayKm: null }));
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "delivery_unverifiable");
});

Deno.test("Abholung mit behaupteter Liefergebuehr/Aufschlag wird abgelehnt", () => {
  assert(!verifyCateringOrder(base({ clientDeliveryEuro: 5, clientTotalEuro: 168 })).ok);
  assert(!verifyCateringOrder(base({ clientSurchargeEuro: 5, clientTotalEuro: 168 })).ok);
});

Deno.test("Pizza-only nur bei reinen Pizza-Warenkoerben", () => {
  assert(isPizzaOnlyOrder([{ id: "pz", quantity: 4, price: 9.9 }], catalog));
  assert(!isPizzaOnlyOrder([{ id: "pz", quantity: 4, price: 9.9 }, { id: "a", quantity: 4, price: 12.9 }], catalog));
  assert(!isPizzaOnlyOrder([{ id: "pz", quantity: 4, price: 9.9 }, { id: "chafing-dish", quantity: 1, price: 25 }], catalog));
  // 5 km Pizza: Hinfahrt 59,50; Mindestbestellwert 150: 39,6 -> Aufschlag 110,40
  const r = verifyCateringOrder({
    lines: [{ id: "pz", quantity: 4, price: 9.9 }], catalog, isPickup: false, oneWayKm: 5,
    clientDeliveryEuro: 59.5, clientSurchargeEuro: 110.4, clientTotalEuro: 39.6 + 110.4 + 59.5,
  });
  assert(r.ok);
});
