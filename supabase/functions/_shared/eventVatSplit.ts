// 70/30-Aufteilung von Event-Paketen für die Lexoffice-Rechnung. Reine Funktionen, keine I/O.
// Quelle: § 12 Abs. 2 Nr. 15 UStG (ab 01.01.2026) und BMF-Schreiben vom 22.12.2025
// (Abschn. 10.1 Abs. 12 UStAE): Bei Kombiangeboten gilt eine Getränkepauschale von 30 %.
// Gespiegelt aus src/contexts/PriceDisplayContext.tsx (packageParts / itemParts): 70 % Speisen zu 7 %,
// 30 % Getränke zu 19 %. Beträge in Cent, damit die Summe exakt dem Brutto entspricht.

export const EVENT_FOOD_SHARE = 0.7;
export const EVENT_FOOD_VAT = 7;
export const EVENT_DRINKS_VAT = 19;

export interface EventVatParts {
  foodCents: number;
  drinksCents: number;
}

/** Speisenanteil = round(brutto × 0,7), Getränkeanteil = Rest (Summe immer exakt = Brutto). */
export function splitEventGrossCents(grossCents: number): EventVatParts {
  const foodCents = Math.round(grossCents * EVENT_FOOD_SHARE);
  return { foodCents, drinksCents: grossCents - foodCents };
}

/** Event-Paket-Zeile? Wie im Checkout: ID-Präfix `event-` oder ausdrückliche Markierung. */
export function isEventPackageItem(item: { id?: string; isEventPackage?: boolean }): boolean {
  return item.isEventPackage === true || (typeof item.id === "string" && item.id.startsWith("event-"));
}

export interface SplitLine {
  name: string;
  quantity: number;
  /** Brutto-Stückpreis in Euro, cent-genau. */
  grossAmount: number;
  taxRatePercentage: number;
}

/**
 * Teilt eine Paketzeile (Stückpreis × Menge) in zwei Rechnungszeilen.
 * Die Aufteilung erfolgt je Stück, die Menge bleibt wie bisher; Stück-Summe = Stückpreis,
 * damit die Zeilensumme (Menge × Stückpreis) unverändert bleibt.
 * Ein Anteil von 0 € entfällt (bei Stückpreis 0 gibt es keine Zeilen).
 */
export function splitEventPackageLine(item: { name: string; quantity: number; price: number }): SplitLine[] {
  const unitCents = Math.round(item.price * 100);
  const { foodCents, drinksCents } = splitEventGrossCents(unitCents);
  const lines: SplitLine[] = [];
  if (foodCents !== 0) {
    lines.push({
      name: `${item.name} – Speisen`,
      quantity: item.quantity,
      grossAmount: foodCents / 100,
      taxRatePercentage: EVENT_FOOD_VAT,
    });
  }
  if (drinksCents !== 0) {
    lines.push({
      name: `${item.name} – Getränke`,
      quantity: item.quantity,
      grossAmount: drinksCents / 100,
      taxRatePercentage: EVENT_DRINKS_VAT,
    });
  }
  return lines;
}
