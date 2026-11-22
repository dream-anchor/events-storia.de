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

Deno.test("Aufschlag mit/ohne Chafing-Basis: Bereich akzeptiert (B2)", () => {
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }, { id: "chafing-dish", quantity: 1, price: 25 }]; // 154 gesamt
  // Basis ohne Chafing = 129 => Aufschlag 21; Basis mit Chafing = 154 => 0. Beides zulaessig.
  const mk = (sur: number) => verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 5, clientDeliveryEuro: 119, clientSurchargeEuro: sur, clientTotalEuro: 154 + sur + 119,
  });
  assert(mk(21).ok);
  assert(mk(0).ok);
  assert(mk(10).ok); // B2: Bereich zwischen den Basen
  assert(!mk(22).ok);
  assert(!mk(-1).ok);
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
  // 5 km Pizza: Hinfahrt 59,50; Mindestbestellwert 150: 39,6 -> Aufschlag 110,40
  const r = verifyCateringOrder({
    lines: [{ id: "pz", quantity: 4, price: 9.9 }], catalog, isPickup: false, oneWayKm: 5,
    clientDeliveryEuro: 59.5, clientSurchargeEuro: 110.4, clientTotalEuro: 39.6 + 110.4 + 59.5,
  });
  assert(r.ok);
});

Deno.test("B1: Namen muessen zum Katalog passen (DE und EN), Server-Namen gehen sonst nicht durch", () => {
  const cat: Catalog = { n: { price: 10, active: true, menuSlug: "x", name: "Lasagne", nameEn: "Lasagna" } };
  const mk = (name: string | null, name_en: string | null) => verifyCateringOrder({
    lines: [{ id: "n", quantity: 4, price: 10, name, name_en }], catalog: cat, isPickup: true, oneWayKm: null,
    clientDeliveryEuro: 0, clientSurchargeEuro: 0, clientTotalEuro: 40,
  });
  assert(mk("Lasagne", "Lasagna").ok);
  assert(mk(" Lasagne ", "Lasagna").ok);
  const de = mk("Gratis-Lasagne", "Lasagna");
  assert(!de.ok);
  if (!de.ok) assertEquals(de.code, "name_mismatch");
  const en = mk("Lasagne", "Hacked");
  assert(!en.ok);
  const nul = mk("Lasagne", null);
  assert(!nul.ok);
  const noEn: Catalog = { n: { price: 10, active: true, name: "Lasagne", nameEn: null } };
  assert(verifyCateringOrder({ lines: [{ id: "n", quantity: 4, price: 10, name: "Lasagne", name_en: null }], catalog: noEn, isPickup: true, oneWayKm: null, clientDeliveryEuro: 0, clientSurchargeEuro: 0, clientTotalEuro: 40 }).ok);
});

Deno.test("B1: nicht veroeffentlichtes Menue = active false = abgelehnt", () => {
  const cat: Catalog = { u: { price: 10, active: false, menuSlug: null, name: "A" } };
  const r = verifyCateringOrder({ lines: [{ id: "u", quantity: 4, price: 10, name: "A" }], catalog: cat, isPickup: true, oneWayKm: null, clientDeliveryEuro: 0, clientSurchargeEuro: 0, clientTotalEuro: 40 });
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "item_unavailable");
});

Deno.test("B3: Chafing-Zeile ignoriert bei Pizza-only, beide Gebuehr-Varianten zulaessig", () => {
  assert(isPizzaOnlyOrder([{ id: "pz", quantity: 4, price: 9.9 }, { id: "chafing-dish", quantity: 1, price: 25 }], catalog));
  assert(!isPizzaOnlyOrder([{ id: "chafing-dish", quantity: 1, price: 25 }], catalog));
  const lines: ClientLine[] = [{ id: "pz", quantity: 20, price: 9.9 }, { id: "chafing-dish", quantity: 1, price: 25 }]; // 198 + 25 = 223
  for (const fee of [59.5, 119]) {
    const r = verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 5, clientDeliveryEuro: fee, clientSurchargeEuro: 0, clientTotalEuro: 223 + fee });
    assert(r.ok, `fee ${fee}`);
  }
  assert(!verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 5, clientDeliveryEuro: 10, clientSurchargeEuro: 0, clientTotalEuro: 233 }).ok);
});

Deno.test("W2: Distanz +-0,05 km: Gebuehr ueber 8 km und Grenze 8 km / 1 km", () => {
  const lines: ClientLine[] = [{ id: "a", quantity: 20, price: 12.9 }]; // 258
  const fee = (km: number) => deliveryFeeGrossCents(km, false) / 100;
  // 12,03 km Server, Client hatte 12,00 km
  const r = verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 12.03, clientDeliveryEuro: fee(12), clientSurchargeEuro: 0, clientTotalEuro: 258 + fee(12) });
  assert(r.ok);
  // 1 km Grenze: Server 1,03 km (Stufe 2), Client 0,98 km (frei)
  const g = verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 1.03, clientDeliveryEuro: 0, clientSurchargeEuro: 0, clientTotalEuro: 258 });
  assert(g.ok);
  // weit ausserhalb: 12,5 km vs. Client 12 km
  assert(!verifyCateringOrder({ lines, catalog, isPickup: false, oneWayKm: 12.5, clientDeliveryEuro: fee(12), clientSurchargeEuro: 0, clientTotalEuro: 258 + fee(12) }).ok);
  // Mindestbestellwert-Fenster an der 8-km-Grenze: Server 8,02 km => Min 200, Client 7,99 km => Min 150; Warenkorb 100
  const lines2: ClientLine[] = [{ id: "pz", quantity: 10, price: 9.9 }]; // 99
  const m = verifyCateringOrder({ lines: lines2, catalog, isPickup: false, oneWayKm: 8.02, clientDeliveryEuro: 59.5, clientSurchargeEuro: 51, clientTotalEuro: 99 + 51 + 59.5 });
  assert(m.ok);
});

// ---------------------------------------------------------------------------
// Mischbestellung (Entscheidung 22.11.2026): Körbe zählen zum Mindestbestellwert; Altpfad bleibt für alte Tabs tolerant
// ---------------------------------------------------------------------------
Deno.test("Altpfad Misch: Aufschlag MIT Korbwert (neue Regel) wird akzeptiert", () => {
  // Pizza-Position 129 EUR (a x10) + Korb 100 EUR bei 12 km (Mindestwert 200): neu Aufschlag 0, alt 71
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }];
  const fee = deliveryFeeGrossCents(12, false) / 100;
  const r = verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 12, giftCents: 10000,
    clientDeliveryEuro: fee, clientSurchargeEuro: 0, clientTotalEuro: 129 + fee,
  });
  assert(r.ok);
});

Deno.test("Altpfad Misch: alter Tab mit Catering-only-Aufschlag läuft NICHT in surcharge_mismatch (Obergrenze unverändert)", () => {
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }];
  const fee = deliveryFeeGrossCents(12, false) / 100;
  const r = verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 12, giftCents: 10000,
    clientDeliveryEuro: fee, clientSurchargeEuro: 71, clientTotalEuro: 129 + 71 + fee,
  });
  assert(r.ok);
});

Deno.test("Altpfad Misch: zu niedriger Aufschlag (unter der neuen Regel) wird abgelehnt", () => {
  // 129 + Korb 50 = 179 < 200 => mindestens 21 EUR Aufschlag; 0 ist zu wenig
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }];
  const fee = deliveryFeeGrossCents(12, false) / 100;
  const r = verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 12, giftCents: 5000,
    clientDeliveryEuro: fee, clientSurchargeEuro: 0, clientTotalEuro: 129 + fee,
  });
  assert(!r.ok);
  if (!r.ok) assertEquals(r.code, "surcharge_mismatch");
});

Deno.test("Altpfad ohne Korb: Untergrenze unverändert (Aufschlag 0 bei 12 km abgelehnt)", () => {
  const lines: ClientLine[] = [{ id: "a", quantity: 10, price: 12.9 }];
  const fee = deliveryFeeGrossCents(12, false) / 100;
  const r = verifyCateringOrder({
    lines, catalog, isPickup: false, oneWayKm: 12,
    clientDeliveryEuro: fee, clientSurchargeEuro: 0, clientTotalEuro: 129 + fee,
  });
  assert(!r.ok);
});
