// Rundungslogik der Netto-Anzeige. Ausführen: npx tsx --test src/components/checkout/netDisplay.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateNetCents, itemParts, cateringLineParts, packageParts, netCentsOfParts, VAT_RATES } from "../../contexts/PriceDisplayContext";
import { splitNetCents, lineNetCents, subtotalNetCents } from "./VatTotals";

const sum = (a: number[]) => a.reduce((s, c) => s + c, 0);
const grossCents = (x: number) => Math.round(x * 100);

// Hilfsfunktion: Steuerbeträge eines Warenkorbs wie im Checkout (je Teil Brutto minus Netto, Cent-Rundung erst in splitNetCents)
const vatOf = (items: { id: string; price: number; quantity: number }[]) => {
  const parts = cateringLineParts(items);
  const vat = (rate: number) => parts.filter(p => p.vatRate === rate).reduce((s, p) => s + (p.gross - p.gross / (1 + rate)), 0);
  return { v7: vat(VAT_RATES.FOOD), v19: vat(VAT_RATES.DRINKS) };
};

const WARENKOERBE: { name: string; items: { id: string; price: number; quantity: number }[] }[] = [
  { name: "nur Speisen (7 %)", items: [
    { id: "a", price: 4.9, quantity: 7 }, { id: "b", price: 12.5, quantity: 3 }, { id: "c", price: 3.3, quantity: 11 } ] },
  { name: "Event-Paket 70/30", items: [{ id: "event-x", price: 89, quantity: 23 }] },
  { name: "gemischt Speisen + 2 Pakete", items: [
    { id: "a", price: 6.9, quantity: 13 }, { id: "event-x", price: 74.5, quantity: 17 }, { id: "event-y", price: 119, quantity: 31 } ] },
  { name: "viele Kleinpositionen", items: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, price: 1.1 + i * 0.37, quantity: 3 + i })) },
];

for (const { name, items } of WARENKOERBE) {
  test(`Netto-Zeilen ergeben genau Netto-Gesamt: ${name}`, () => {
    const alloc = allocateNetCents(items.map(i => itemParts(i, i.quantity)));
    assert.equal(sum(alloc.lines), alloc.total);
    // Gesamt = einmal gerundete exakte Netto-Summe
    assert.equal(alloc.total, netCentsOfParts(cateringLineParts(items)));
    // keine Zeile weicht mehr als 1 ct vom exakten Wert ab
    items.forEach((i, idx) => {
      const exact = itemParts(i, i.quantity).reduce((s, p) => s + (p.gross / (1 + p.vatRate)) * 100, 0);
      assert.ok(Math.abs(alloc.lines[idx] - exact) < 1 + 1e-6);
    });
  });

  test(`Brutto unverändert, Netto + MwSt. = Zahlbetrag: ${name}`, () => {
    const gross = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const { v7, v19 } = vatOf(items);
    const { vat7C, vat19C, netC } = splitNetCents(gross, v7, v19, 0);
    assert.equal(netC + vat7C + vat19C, grossCents(gross));
    // Zwischensumme als Rest mit Lieferung (19 %) und Aufschlag (7 %): Zeilen + Summe gehen auf
    const delivery = 50;
    const surcharge = 12.34;
    const g2 = gross + delivery + surcharge;
    const s2 = splitNetCents(g2, v7 + (surcharge - surcharge / 1.07), v19, delivery - delivery / 1.19);
    const rest = [lineNetCents(surcharge, VAT_RATES.FOOD), lineNetCents(delivery, VAT_RATES.DELIVERY)];
    assert.equal(subtotalNetCents(s2.netC, rest) + sum(rest), s2.netC);
  });
}

test("Beispielrechnung: 3 Positionen zu 7 % (brutto 10,70 / 10,70 / 10,70)", () => {
  // Einzeln gerundet: 3 x 10,00 = 30,00; exakt 32,10 / 1,07 = 30,00 -> kein Unterschied
  const items = [1, 2, 3].map(i => ({ id: `s${i}`, price: 10.7, quantity: 1 }));
  const alloc = allocateNetCents(items.map(i => itemParts(i, 1)));
  assert.deepEqual(alloc.lines, [1000, 1000, 1000]);
  assert.equal(alloc.total, 3000);
});

test("Beispielrechnung: Rundungsrest wird verteilt (3 x 1,00 brutto zu 7 %)", () => {
  // Je Zeile 0,93457 -> einzeln gerundet 0,93 (Summe 2,79), Gesamt 2,80 (2,8037). Verteilung: 93 + 93 + 94 = 280
  const items = [1, 2, 3].map(i => ({ id: `s${i}`, price: 1, quantity: 1 }));
  const alloc = allocateNetCents(items.map(i => itemParts(i, 1)));
  assert.equal(alloc.total, 280);
  assert.equal(sum(alloc.lines), 280);
  assert.deepEqual([...alloc.lines].sort(), [93, 93, 94]);
});

test("Event-Paket: 70 % zu 7 %, 30 % zu 19 %", () => {
  // 119,00 brutto: 83,30 / 1,07 = 77,8505 + 35,70 / 1,19 = 30,00 -> 107,85
  assert.equal(netCentsOfParts(packageParts(119)), 10785);
});

test("Zwischensumme als Rest: Lieferung 19 % und Aufschlag 7 % im Netto-Gesamtbetrag", () => {
  // Waren 100,00 (7 %), Aufschlag 20,00 (7 %), Lieferung 50,00 (19 %): Brutto 170,00
  // MwSt. 7 %: 120 - 120/1,07 = 7,8505 -> 785 ct; MwSt. 19 %: 50 - 50/1,19 = 7,9832 -> 798 ct; netC = 17000 - 785 - 798 = 15417
  const s = splitNetCents(170, 120 - 120 / 1.07, 0, 50 - 50 / 1.19);
  assert.equal(s.netC, 15417);
  const rest = [lineNetCents(20, 0.07), lineNetCents(50, 0.19)]; // 1869 + 4202
  assert.deepEqual(rest, [1869, 4202]);
  assert.equal(subtotalNetCents(s.netC, rest), 9346); // 15417 - 6071
});
