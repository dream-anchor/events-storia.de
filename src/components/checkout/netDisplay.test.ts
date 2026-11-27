// Rundungslogik der Netto-Anzeige. Ausführen: npx tsx --test src/components/checkout/netDisplay.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateNetCents, itemParts, cateringLineParts, packageParts, netCentsOfParts, lineParts, VAT_RATES } from "../../contexts/PriceDisplayContext";
import { splitNetCents, lineNetCents, subtotalNetCents, quoteNetBreakdown, toCents } from "../../lib/netDisplay";
import type { QuoteLine } from "../../lib/orderQuote";

const sum = (a: number[]) => a.reduce((s, c) => s + c, 0);

type CartLine = { id: string; price: number; quantity: number };

/** Server-Angebot aus Warenkorb-Zeilen nachbauen (Event-Pakete: Zeilenbetrag = Stückpreis x Gäste). */
const makeQuote = (items: CartLine[], opts: { chafingCheckout?: number; surcharge?: number; delivery?: number } = {}) => {
  const lines: QuoteLine[] = items.map(i => ({
    id: i.id, name: i.id, name_en: null, quantity: i.quantity, unitCents: toCents(i.price),
    lineCents: toCents(i.price * i.quantity), kind: i.id.startsWith("event-") ? "event_package" : "menu",
    priceChanged: false, nameChanged: false,
  }));
  const chafing = opts.chafingCheckout ?? 0;
  if (chafing > 0) {
    lines.push({ id: "chafing", name: "Chafing", name_en: null, quantity: 1, unitCents: chafing, lineCents: chafing,
      kind: "chafing_checkout", priceChanged: false, nameChanged: false });
  }
  const surchargeCents = opts.surcharge ?? 0;
  const deliveryCents = opts.delivery ?? 0;
  const itemsCents = sum(lines.map(l => l.lineCents));
  return { lines, surchargeCents, deliveryCents, totalCents: itemsCents + surchargeCents + deliveryCents };
};

const WARENKOERBE: { name: string; items: CartLine[] }[] = [
  { name: "nur Speisen (7 %)", items: [
    { id: "a", price: 4.9, quantity: 7 }, { id: "b", price: 12.5, quantity: 3 }, { id: "c", price: 3.3, quantity: 11 } ] },
  { name: "Event-Paket 70/30", items: [{ id: "event-x", price: 89, quantity: 23 }] },
  { name: "Event-Paket 270 EUR", items: [{ id: "event-z", price: 270, quantity: 1 }] },
  { name: "gemischt Speisen + 2 Pakete", items: [
    { id: "a", price: 6.9, quantity: 13 }, { id: "event-x", price: 74.5, quantity: 17 }, { id: "event-y", price: 119, quantity: 31 } ] },
  { name: "viele Kleinpositionen", items: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, price: 1.1 + i * 0.37, quantity: 3 + i })) },
];

for (const { name, items } of WARENKOERBE) {
  test(`Netto-Zeilen ergeben genau Netto-Gesamt: ${name}`, () => {
    const alloc = allocateNetCents(items.map(i => itemParts(i, i.quantity)));
    assert.equal(sum(alloc.lines), alloc.total);
    items.forEach((i, idx) => {
      const exact = itemParts(i, i.quantity).reduce((s, p) => s + (p.gross / (1 + p.vatRate)) * 100, 0);
      assert.ok(Math.abs(alloc.lines[idx] - exact) < 1 + 1e-6, "Zeile weicht höchstens 1 ct vom exakten Wert ab");
    });
  });

  test(`Warenkorb-Netto = Checkout-Netto (auf den Cent): ${name}`, () => {
    const cart = allocateNetCents(items.map(i => itemParts(i, i.quantity))).total;
    const checkout = quoteNetBreakdown(makeQuote(items)).netC;
    assert.equal(cart, checkout);
    assert.equal(netCentsOfParts(cateringLineParts(items)), checkout);
  });

  test(`Brutto unverändert, Netto + MwSt. = Zahlbetrag: ${name}`, () => {
    const q = makeQuote(items, { chafingCheckout: 2500, surcharge: 1234, delivery: 5000 });
    const b = quoteNetBreakdown(q);
    const { vat7C, vat19C, netC } = splitNetCents(b.grandTotal, b.vat7Food, b.vat19Drinks, b.vat19Delivery);
    assert.equal(netC + vat7C + vat19C, q.totalCents);
    // Zwischensumme + Chafing + Aufschlag + Lieferung = Netto-Gesamt (Zeilen und Summe gehen auf)
    assert.equal(b.subtotalNetC + b.chafingNetC + b.surchargeNetC + b.deliveryNetC, b.netC);
    assert.ok(b.subtotalNetC >= 0);
  });
}

test("Event-Paket 270 EUR: Warenkorb und Checkout beide 244,71", () => {
  // 70 %: 189,00 / 1,07 -> MwSt. 12,36; 30 %: 81,00 / 1,19 -> MwSt. 12,93; Netto = 270,00 - 12,36 - 12,93 = 244,71
  const cart = allocateNetCents([packageParts(270)]);
  assert.equal(cart.total, 24471);
  assert.equal(quoteNetBreakdown(makeQuote([{ id: "event-z", price: 270, quantity: 1 }])).netC, 24471);
});

test("Zwischensumme nie negativ: Chafing/Warenkorb weichen vom (alten) Angebot ab", () => {
  // altes Angebot: 100,00 ohne Chafing; im Browser schon 90,00 Chafing + 20,00 Aufschlag dazu, Netto-Zeilen größer als netC
  const alt = quoteNetBreakdown(makeQuote([{ id: "a", price: 100, quantity: 1 }]));
  const stale = subtotalNetCents(alt.netC, [lineNetCents(90, VAT_RATES.FOOD), lineNetCents(20, VAT_RATES.FOOD)]);
  assert.equal(stale, 0);
  // aus dem Angebot selbst gerechnet bleibt die Zwischensumme exakt der Positionswert
  assert.equal(alt.subtotalNetC, alt.netC);
  assert.ok(alt.subtotalNetC > 0);
});

test("Rundungsrest wird verteilt (3 x 1,00 brutto zu 7 %)", () => {
  // Je Zeile 0,93457: einzeln gerundet 3 x 0,93 = 2,79; Gesamt 3,00 - 0,20 MwSt. = 2,80. Verteilung 93 + 93 + 94
  const alloc = allocateNetCents([1, 2, 3].map(() => lineParts("s", 1)));
  assert.equal(alloc.total, 280);
  assert.deepEqual([...alloc.lines].sort(), [93, 93, 94]);
});

test("Erfolgsseite mit Körben und Event-Paket: Körbe nicht im Netto, Lieferung getrennt von Getränken", () => {
  const items: CartLine[] = [{ id: "event-x", price: 150, quantity: 20 }, { id: "a", price: 8.5, quantity: 6 }];
  const q = makeQuote(items, { surcharge: 0, delivery: 6000 });
  const gift = 79.9; // Korb brutto, separat bezahlt
  const b = quoteNetBreakdown(q);
  // Netto bezieht sich NUR auf den Catering-Betrag
  const net = splitNetCents(b.grandTotal, b.vat7Food, b.vat19Drinks, b.vat19Delivery);
  assert.equal(net.netC + net.vat7C + net.vat19C, q.totalCents);
  // 19 % Getränke und 19 % Lieferung sind getrennt vorhanden (Beschriftung "Getränke & Lieferung")
  assert.ok(b.vat19Drinks > 0 && b.vat19Delivery > 0);
  assert.equal(toCents(b.vat19Delivery), 958); // 60,00 - 60,00 / 1,19 = 9,58
  // Zeilen netto: Summe = Zwischensumme (Rest aus netC), Event-Paket nach ID 70/30
  const lineItems = q.lines.map(l => lineParts(l.id, l.lineCents / 100));
  const alloc = allocateNetCents(lineItems, b.subtotalNetC);
  assert.equal(sum(alloc.lines), b.subtotalNetC);
  // Gesamtanzeige mit Korb: Zahlbetrag Catering + Korb brutto
  assert.equal(toCents(b.grandTotal + gift), q.totalCents + toCents(gift));
});

test("Erfolgsseite brutto: Zwischensumme + Aufschlag + Lieferung = Catering-Betrag", () => {
  const q = makeQuote([{ id: "a", price: 7.7, quantity: 9 }], { surcharge: 2345, delivery: 5000 });
  const subtotalC = q.totalCents - q.surchargeCents - q.deliveryCents;
  assert.equal(subtotalC + q.surchargeCents + q.deliveryCents, q.totalCents);
  assert.equal(subtotalC, sum(q.lines.map(l => l.lineCents)));
});

test("Event-Paket: 70 % zu 7 %, 30 % zu 19 %", () => {
  // 119,00 brutto: MwSt. 7 % auf 83,30 = 5,45; MwSt. 19 % auf 35,70 = 5,70 -> Netto 107,85
  assert.equal(netCentsOfParts(packageParts(119)), 10785);
});

// ─── Umsatzsteuer-Entscheidungen 27.11.2026 (Anzeige im Warenkorb/Checkout/Erfolgsseite) ─────────
const BENVENUTI = "event-d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3"; // Gruppenreise mit Getränken
const CANDLE_48 = "event-5a434d47-d21a-4887-92a1-487e837d22d9"; // nur Speisen

test("E1 Gruppenreise Benvenuti 45 EUR x 20 = 900,00: 70/30, Netto 815,68 (vorher bereits 70/30 in der Anzeige)", () => {
  const items: CartLine[] = [{ id: BENVENUTI, price: 45, quantity: 20 }];
  // 630,00 -> MwSt. 41,21 (7 %); 270,00 -> MwSt. 43,11 (19 %); Netto = 900,00 - 84,32 = 815,68
  assert.equal(netCentsOfParts(cateringLineParts(items)), 81568);
  const b = quoteNetBreakdown(makeQuote(items));
  assert.equal(toCents(b.vat7Food), 4121);
  assert.equal(toCents(b.vat19Drinks), 4311);
  assert.equal(b.netC, 81568);
});

test("E2 Speisen-Paket Candlelight 48 EUR x 10 = 480,00: nur 7 %, Netto 448,60 (vorher 435,03 mit 70/30)", () => {
  const items: CartLine[] = [{ id: CANDLE_48, price: 48, quantity: 10 }];
  assert.deepEqual(lineParts(CANDLE_48, 480), [{ gross: 480, vatRate: 0.07 }]);
  assert.equal(netCentsOfParts(cateringLineParts(items)), 44860);
  assert.equal(netCentsOfParts(packageParts(480)), 43503); // alte Anzeige: 336,00 / 1,07 + 144,00 / 1,19
  const b = quoteNetBreakdown(makeQuote(items));
  assert.equal(toCents(b.vat7Food), 3140);
  assert.equal(b.vat19Drinks, 0);
  assert.equal(b.netC, 44860);
  // Warenkorb = Checkout auf den Cent
  assert.equal(allocateNetCents(items.map(i => itemParts(i, i.quantity))).total, b.netC);
});

test("E5 Chafing 25 EUR: Netto 21,01 / MwSt. 3,99 zu 19 % (vorher 23,36 / 1,64 zu 7 %), Warenkorb und Checkout gleich", () => {
  assert.deepEqual(lineParts("chafing-dish", 25), [{ gross: 25, vatRate: 0.19 }]);
  assert.equal(VAT_RATES.CHAFING, 0.19);
  assert.equal(lineNetCents(25, VAT_RATES.CHAFING), 2101);
  // Warenkorb-Chafing (kind chafing_cart, ID chafing-dish) + Checkout-Chafing
  const q = makeQuote([{ id: "a", price: 30, quantity: 10 }, { id: "chafing-dish", price: 25, quantity: 1 }], { chafingCheckout: 5000 });
  q.lines[1].kind = "chafing_cart";
  const b = quoteNetBreakdown(q);
  assert.equal(toCents(b.vat19Rental), 1197); // 75,00 - 75,00 / 1,19 = 11,97
  assert.equal(toCents(b.vat7Food), 1963); // 300,00 zu 7 %
  assert.equal(b.chafingNetC, 4202); // Checkout-Zeile 50,00 -> 42,02
  const net = splitNetCents(b.grandTotal, b.vat7Food, b.vat19Drinks, b.vat19Delivery, b.vat19Rental);
  assert.equal(net.netC, b.netC);
  assert.equal(net.netC + net.vat7C + net.vat19C, q.totalCents); // 375,00 brutto unverändert
  assert.equal(b.subtotalNetC + b.chafingNetC + b.surchargeNetC + b.deliveryNetC, b.netC);
  // Warenkorb-Netto (ohne Checkout-Chafing) = Checkout-Netto derselben Zeilen
  const cartOnly = makeQuote([{ id: "a", price: 30, quantity: 10 }, { id: "chafing-dish", price: 25, quantity: 1 }]);
  cartOnly.lines[1].kind = "chafing_cart";
  assert.equal(allocateNetCents([itemParts({ id: "a", price: 30 }, 10), itemParts({ id: "chafing-dish", price: 25 }, 1)]).total, quoteNetBreakdown(cartOnly).netC);
});

test("E4 reine Speisenlieferung 119,00: Lieferung zu 7 % (Netto 111,21), 19-%-Zeile entfällt; mit 19 % wie bisher 100,00", () => {
  const base = makeQuote([{ id: "a", price: 30, quantity: 10 }], { delivery: 11900 });
  const at7 = quoteNetBreakdown({ ...base, delivery: { deliveryVatRate: 0.07 } } as typeof base);
  assert.equal(at7.deliveryVatRate, 0.07);
  assert.equal(at7.vat19Delivery, 0);
  assert.equal(at7.deliveryNetC, 11121);
  // 7 % auf 300,00 + 119,00 = 419,00 gemeinsam gerundet (wie Lexoffice je Steuersatz): 27,41 (einzeln 19,63 + 7,79)
  assert.equal(toCents(at7.vat7Food), 2741);
  assert.equal(at7.netC + toCents(at7.vat7Food), base.totalCents); // 419,00 brutto unverändert
  assert.equal(at7.subtotalNetC + at7.surchargeNetC + at7.deliveryNetC + at7.chafingNetC, at7.netC);
  const at19 = quoteNetBreakdown({ ...base, delivery: { deliveryVatRate: 0.19 } } as typeof base);
  assert.equal(at19.deliveryNetC, 10000);
  assert.equal(toCents(at19.vat19Delivery), 1900);
  // ohne Satz im Angebot (ältere Server-Version): 19 %
  assert.equal(quoteNetBreakdown(base).deliveryVatRate, 0.19);
});
