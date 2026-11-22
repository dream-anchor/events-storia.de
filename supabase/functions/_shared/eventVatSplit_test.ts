import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isEventPackageItem, splitEventGrossCents, splitEventPackageLine } from "./eventVatSplit.ts";

const cents = (v: number) => Math.round(v * 100);
const sum = (lines: { quantity: number; grossAmount: number }[]) =>
  lines.reduce((s, l) => s + l.quantity * cents(l.grossAmount), 0);

Deno.test("Aufteilung: 70/30 cent-genau, Summe = Brutto (ungerade Cent)", () => {
  assertEquals(splitEventGrossCents(10000), { foodCents: 7000, drinksCents: 3000 });
  assertEquals(splitEventGrossCents(9999), { foodCents: 6999, drinksCents: 3000 });
  assertEquals(splitEventGrossCents(1), { foodCents: 1, drinksCents: 0 });
  assertEquals(splitEventGrossCents(3), { foodCents: 2, drinksCents: 1 });
  for (let c = 0; c < 5000; c++) {
    const p = splitEventGrossCents(c);
    assertEquals(p.foodCents + p.drinksCents, c);
  }
});

Deno.test("Paketzeile: zwei Zeilen mit 7 % und 19 %, Menge bleibt", () => {
  const lines = splitEventPackageLine({ name: "Event-Paket: Classic", quantity: 20, price: 69 });
  assertEquals(lines, [
    { name: "Event-Paket: Classic – Speisen", quantity: 20, grossAmount: 48.3, taxRatePercentage: 7 },
    { name: "Event-Paket: Classic – Getränke", quantity: 20, grossAmount: 20.7, taxRatePercentage: 19 },
  ]);
});

Deno.test("Rechnungssumme brutto unverändert (mehrere Beispiele, Mehrpaket, ungerade Cent)", () => {
  const cases = [
    [{ name: "A", quantity: 1, price: 69 }],
    [{ name: "A", quantity: 37, price: 89.99 }],
    [{ name: "A", quantity: 3, price: 33.33 }, { name: "B", quantity: 12, price: 54.55 }],
    [{ name: "A", quantity: 7, price: 0.01 }, { name: "B", quantity: 2, price: 8500 }, { name: "C", quantity: 41, price: 119.95 }],
  ];
  for (const items of cases) {
    const before = items.reduce((s, i) => s + i.quantity * Math.round(i.price * 100), 0);
    const after = sum(items.flatMap((i) => splitEventPackageLine(i)));
    assertEquals(after, before);
  }
});

Deno.test("Preis 0: keine Zeilen", () => {
  assertEquals(splitEventPackageLine({ name: "A", quantity: 5, price: 0 }), []);
});

Deno.test("Erkennung: ID-Präfix event- oder Markierung", () => {
  assertEquals(isEventPackageItem({ id: "event-abc" }), true);
  assertEquals(isEventPackageItem({ id: "uuid-1", isEventPackage: true }), true);
  assertEquals(isEventPackageItem({ id: "pizza-1" }), false);
  assertEquals(isEventPackageItem({}), false);
});
