// deno test supabase/functions/_shared/vatRules_test.ts
// Umsatzsteuer-Entscheidungen vom 27.11.2026 (Betreiber Mimmo, bestätigt von Antoine) mit Beispielbeträgen.
// Je Entscheidung: Zahlbetrag (Brutto) unverändert, Aufteilung auf die Steuersätze cent-genau.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { CHAFING_DISH_ID, FIXED_ITEM_PRICES_CENTS, deliveryFeeGrossCents, type Catalog } from "./cateringPricing.ts";
import { LOCATION_PACKAGE_ID } from "./eventPricing.ts";
import { packageInvoiceLines, shouldSplitOfferAsEventPackage, splitEventPackageLine } from "./eventVatSplit.ts";
import { buildOrderQuote, type OrderQuote, type QuotePackage } from "./orderQuote.ts";
import { shopFieldsFromCatering } from "./maestroHandoff.ts";
import {
  CHAFING_LINE_ID, FOOD_ONLY_PACKAGE_IDS, cateringDeliveryVatPercent, cateringItemVatPercent, packageHasDrinks, packageIdOf,
} from "./vatRules.ts";

const BENVENUTI = "d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3"; // gruppenreisen, 45 EUR p. P., Getränke laut includes
const PIZZA_E_PASTA = "80b98b7b-0b3a-4002-afb2-cf416f06fcfb"; // gruppenreisen, 25 EUR p. P.
const TRADIZIONE = "dea69975-21ee-4957-956c-fbe2fd300803"; // gruppenreisen, 67 EUR p. P.
const CANDLE_48 = "5a434d47-d21a-4887-92a1-487e837d22d9"; // nur Speisen
const CANDLE_78 = "f4b3c534-2807-47b5-81bd-087a7650164a"; // nur Speisen
const NETWORK = "f7db9e2e-5584-4718-9e66-757c38da338d"; // event, 69 EUR p. P., Weine & Cocktails

const cents = (v: number) => Math.round(v * 100);
const lineSum = (lines: { quantity: number; grossAmount: number }[]) => lines.reduce((s, l) => s + l.quantity * cents(l.grossAmount), 0);
const byRate = (lines: { quantity: number; grossAmount: number; taxRatePercentage: number }[]) => {
  const out: Record<number, number> = {};
  for (const l of lines) out[l.taxRatePercentage] = (out[l.taxRatePercentage] ?? 0) + l.quantity * cents(l.grossAmount);
  return out;
};
/** enthaltene Steuer in Cent wie Lexoffice im Brutto-Modus: Brutto - Brutto / (1 + Satz), auf den Cent */
const vatOf = (grossCents: number, rate: number) => Math.round(grossCents - grossCents / (1 + rate / 100));

Deno.test("Chafing-ID: vatRules und cateringPricing stimmen überein", () => {
  assertEquals(CHAFING_LINE_ID, CHAFING_DISH_ID);
  assertEquals(FIXED_ITEM_PRICES_CENTS[CHAFING_LINE_ID], 2500); // Bruttopreis bleibt 25 EUR
});

// ─── Entscheidung 1: Pakete mit Speisen und Getränken 70/30, auch Gruppenreisen ─────────────────
Deno.test("E1 Gruppenreise Benvenuti 45 EUR x 20: vorher 900,00 zu 7 %, jetzt 630,00 zu 7 % + 270,00 zu 19 %", () => {
  // Shop-Weg: Warenkorbzeile event-<id>, create-lexoffice-invoice teilt über packageInvoiceLines
  const lines = packageInvoiceLines({ id: `event-${BENVENUTI}`, name: "Benvenuti", quantity: 20, price: 45 });
  assertEquals(lines, [
    { name: "Benvenuti – Speisen", quantity: 20, grossAmount: 31.5, taxRatePercentage: 7 },
    { name: "Benvenuti – Getränke", quantity: 20, grossAmount: 13.5, taxRatePercentage: 19 },
  ]);
  assertEquals(lineSum(lines), 90000);
  // Steuer: 630,00 -> 41,21 (7 %); 270,00 -> 43,11 (19 %); vorher 900,00 -> 58,88 (7 %)
  assertEquals(vatOf(63000, 7), 4121);
  assertEquals(vatOf(27000, 19), 4311);
  assertEquals(vatOf(90000, 7), 5888);
});

Deno.test("E1 alle Gruppenreise-Pakete und Event-Pakete mit Getränken werden geteilt, Summe cent-genau", () => {
  for (const [id, price, guests] of [[BENVENUTI, 45, 23], [PIZZA_E_PASTA, 25, 37], [TRADIZIONE, 67, 21], [NETWORK, 69, 11]] as const) {
    assert(packageHasDrinks(id));
    const lines = packageInvoiceLines({ id: `event-${id}`, name: "P", quantity: guests, price });
    assertEquals(lines.map((l) => l.taxRatePercentage), [7, 19]);
    assertEquals(lineSum(lines), guests * price * 100);
  }
});

Deno.test("E1 Angebots-Weg: Gruppenreise-Paket ohne Zusatzposten wird jetzt geteilt (vorher nur package_type event)", () => {
  const base = { offerMode: "package", menuSelection: {} };
  assertEquals(shouldSplitOfferAsEventPackage({ ...base, packageType: "gruppenreisen", packageId: BENVENUTI }), true);
  assertEquals(shouldSplitOfferAsEventPackage({ ...base, packageType: "event", packageId: NETWORK }), true);
  // unverändert: Menüs, unbekannte Typen, Zusatzposten (Getränke stehen dann schon im Betrag, keine doppelte 30-%-Pauschale)
  assertEquals(shouldSplitOfferAsEventPackage({ ...base, offerMode: "menu", packageType: "gruppenreisen", packageId: BENVENUTI }), false);
  assertEquals(shouldSplitOfferAsEventPackage({ ...base, packageType: "drinks", packageId: BENVENUTI }), false);
  assertEquals(shouldSplitOfferAsEventPackage({ offerMode: "package", packageType: "gruppenreisen", packageId: BENVENUTI, menuSelection: { drinks: [{ name: "Wein" }] } }), false);
  assertEquals(shouldSplitOfferAsEventPackage({ offerMode: "package", packageType: "event", packageId: NETWORK, menuSelection: { drinksMode: "pauschale" } }), false);
  // ohne packageId (alter Aufrufer): wie bisher geteilt
  assertEquals(shouldSplitOfferAsEventPackage({ ...base, packageType: "event" }), true);
});

Deno.test("E1 Angebots-Weg (create-event-quotation): Paketzeile 69 EUR x 20 -> 48,30 / 20,70 je Person, 1.380,00 gesamt", () => {
  const lines = splitEventPackageLine({ name: "Network-Aperitivo", quantity: 20, price: 69 });
  assertEquals(lines.map((l) => [l.quantity, l.grossAmount, l.taxRatePercentage]), [[20, 48.3, 7], [20, 20.7, 19]]);
  assertEquals(lineSum(lines), 138000);
});

// ─── Entscheidung 2: Pakete nur mit Speisen vollständig 7 % ────────────────────────────────────
Deno.test("E2 Candlelight 48 EUR x 10: vorher 336,00 zu 7 % + 144,00 zu 19 %, jetzt 480,00 zu 7 %", () => {
  assertEquals(FOOD_ONLY_PACKAGE_IDS.length, 2);
  const lines = packageInvoiceLines({ id: `event-${CANDLE_48}`, name: "Candlelight Menü Sharing Edition", quantity: 10, price: 48 });
  assertEquals(lines, [{ name: "Candlelight Menü Sharing Edition", quantity: 10, grossAmount: 48, taxRatePercentage: 7 }]);
  assertEquals(byRate(lines), { 7: 48000 });
  // Steuer vorher: 336,00 -> 21,98 (7 %) + 144,00 -> 22,99 (19 %) = 44,97; jetzt 480,00 -> 31,40 (7 %)
  const before = splitEventPackageLine({ name: "C", quantity: 10, price: 48 });
  assertEquals(byRate(before), { 7: 33600, 19: 14400 });
  assertEquals(vatOf(33600, 7) + vatOf(14400, 19), 4497);
  assertEquals(vatOf(48000, 7), 3140);
});

Deno.test("E2 Candlelight 78 EUR x 3 und Angebots-Weg: nie geteilt; unbekanntes neues Paket gilt als mit Getränken", () => {
  assertEquals(packageInvoiceLines({ id: CANDLE_78, name: "C", quantity: 3, price: 78 }), [{ name: "C", quantity: 3, grossAmount: 78, taxRatePercentage: 7 }]);
  assertEquals(packageHasDrinks(CANDLE_78), false);
  assertEquals(packageHasDrinks(`event-${CANDLE_78}`), false);
  assertEquals(shouldSplitOfferAsEventPackage({ offerMode: "package", packageType: "event", packageId: CANDLE_48, menuSelection: {} }), false);
  assertEquals(packageHasDrinks("11111111-2222-3333-4444-555555555555"), true);
  assertEquals(packageHasDrinks(null), true);
  assertEquals(packageIdOf(`event-${CANDLE_48}`), CANDLE_48);
});

Deno.test("E2 Speisen-Paket mit nicht ganzzahligem Stückpreis: Menge 1, Summe = Zahlbetrag", () => {
  const lines = packageInvoiceLines({ id: CANDLE_48, name: "C", quantity: 3, price: 1000 / 3 });
  assertEquals(lines, [{ name: "C (3 Gäste)", quantity: 1, grossAmount: 1000, taxRatePercentage: 7 }]);
});

// ─── Entscheidung 3: Gesamte Location 70/30, keine Raummiete ───────────────────────────────────
Deno.test("E3 Gesamte Location 8.500 EUR (70 Gäste): 5.950,00 zu 7 % + 2.550,00 zu 19 %, keine eigene Raummiete-Zeile", () => {
  assert(packageHasDrinks(LOCATION_PACKAGE_ID));
  const lines = packageInvoiceLines({ id: `event-${LOCATION_PACKAGE_ID}`, name: "Gesamte Location", quantity: 70, price: 8500 / 70 });
  assertEquals(lines.length, 2);
  assertEquals(byRate(lines), { 7: 595000, 19: 255000 });
  assertEquals(lineSum(lines), 850000);
});

// ─── Entscheidung 4: Lieferkosten 7 % bei reiner Speisenlieferung ──────────────────────────────
const catalog: Catalog = {
  a: { price: 30, active: true, menuSlug: "buffet-platten", name: "Lasagne", nameEn: "Lasagna" },
  pz: { price: 10, active: true, menuSlug: "pizze-napoletane", name: "Margherita", nameEn: "Margherita" },
};
const quote = (over: Partial<Parameters<typeof buildOrderQuote>[0]>, km: number): OrderQuote => {
  const r = buildOrderQuote({ items: [{ id: "a", quantity: 10 }], chafingQuantity: 0, isPickup: false, ...over }, { catalog, packages: {}, oneWayKm: km });
  assert(r.ok, JSON.stringify(r));
  return r.quote;
};

Deno.test("E4 Speisenlieferung 5 km (2 Fahrten): Brutto 119,00 bleibt; vorher 100,00 + 19,00 (19 %), jetzt 111,21 + 7,79 (7 %)", () => {
  const q = quote({}, 5);
  assertEquals(q.deliveryCents, 11900);
  assertEquals(q.totalCents, 30000 + 11900);
  assertEquals(q.delivery?.deliveryVatRate, 0.07);
  assertEquals(q.delivery?.deliveryCostGross, 119);
  assertEquals(q.delivery?.deliveryCostNet, 111.21);
  assertEquals(q.delivery?.deliveryVat, 7.79);
  assertEquals(cents(q.delivery!.deliveryCostNet) + cents(q.delivery!.deliveryVat), q.deliveryCents);
});

Deno.test("E4 Pizza-Lieferung 12 km (1 Fahrt): Brutto 76,64 bleibt, 7 %, Netto + MwSt. = Brutto", () => {
  const q = quote({ items: [{ id: "pz", quantity: 20 }] }, 12);
  assertEquals(q.deliveryCents, deliveryFeeGrossCents(12, true));
  assertEquals(q.deliveryCents, 7664); // (50 + 12 x 1,20) x 1,19 = 76,636 -> 76,64
  assertEquals(q.delivery?.deliveryVatRate, 0.07);
  assertEquals(cents(q.delivery!.deliveryCostNet), 7163); // vorher 64,40 netto (19 %), jetzt 71,63 netto + 5,01 (7 %)
  assertEquals(cents(q.delivery!.deliveryCostNet) + cents(q.delivery!.deliveryVat), 7664);
});

Deno.test("E4 nicht geändert: mit Chafing-Leihgerät oder Geschenkkörben bleibt die Lieferung bei 19 %", () => {
  const mitChafing = quote({ chafingQuantity: 1 }, 5);
  assertEquals([mitChafing.deliveryCents, mitChafing.delivery?.deliveryVatRate, mitChafing.delivery?.deliveryCostNet], [11900, 0.19, 100]);
  const chafingImWarenkorb = quote({ items: [{ id: "a", quantity: 10 }, { id: CHAFING_DISH_ID, quantity: 2 }] }, 5);
  assertEquals(chafingImWarenkorb.delivery?.deliveryVatRate, 0.19);
  const mischbestellung = quote({ giftCents: 4990 }, 5);
  assertEquals([mischbestellung.deliveryCents, mischbestellung.delivery?.deliveryVatRate], [11900, 0.19]);
});

Deno.test("E4 Regel für den Rechnungs-Webhook: gleiche Entscheidung wie das Server-Angebot", () => {
  assertEquals(cateringDeliveryVatPercent({ itemIds: ["a", "pz"], hasGiftBaskets: false }), 7);
  assertEquals(cateringDeliveryVatPercent({ itemIds: ["a", CHAFING_LINE_ID], hasGiftBaskets: false }), 19);
  assertEquals(cateringDeliveryVatPercent({ itemIds: ["a"], hasGiftBaskets: true }), 19);
  assertEquals(cateringDeliveryVatPercent({ itemIds: [], hasGiftBaskets: false }), 19);
  assertEquals(cateringDeliveryVatPercent({ itemIds: [`event-${BENVENUTI}`], hasGiftBaskets: false }), 19);
});

// ─── Entscheidung 5: Chafing Dish 19 %, Brutto 25 EUR ──────────────────────────────────────────
Deno.test("E5 Chafing 25 EUR (Warenkorb und Checkout): vorher 23,36 + 1,64 (7 %), jetzt 21,01 + 3,99 (19 %)", () => {
  assertEquals(cateringItemVatPercent(CHAFING_LINE_ID), 19);
  assertEquals(cateringItemVatPercent("a"), 7);
  assertEquals(cateringItemVatPercent(undefined), 7);
  assertEquals(vatOf(2500, 7), 164);
  assertEquals(vatOf(2500, 19), 399);
  // beide Wege tragen die ID chafing-dish und den Festpreis 25,00 (Brutto unverändert)
  const q = quote({ items: [{ id: "a", quantity: 10 }, { id: CHAFING_DISH_ID, quantity: 1 }], chafingQuantity: 2, isPickup: true }, 0);
  const chafing = q.lines.filter((l) => l.id === CHAFING_LINE_ID);
  assertEquals(chafing.map((l) => [l.kind, l.unitCents, l.lineCents]), [["chafing_cart", 2500, 2500], ["chafing_checkout", 2500, 5000]]);
  assertEquals(q.totalCents, 30000 + 7500);
});

Deno.test("E5 MAESTRO-Übergabe: Chafing-Zeilen mit vatRate 19, Speisen 7", () => {
  const fields = shopFieldsFromCatering({
    items: [{ id: "a", name: "Lasagne", quantity: 10, price: 30 }, { id: CHAFING_DISH_ID, name: "Chafing Dish (Leihgerät)", quantity: 2, price: 25 }],
    is_pickup: true,
  }, null, "paid");
  assertEquals(fields.lines?.map((l) => [l.name, l.vatRate]), [["Lasagne", 7], ["Chafing Dish (Leihgerät)", 19]]);
});
