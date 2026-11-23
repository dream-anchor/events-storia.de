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
 * Ergibt Stückpreis × Menge ganze Cent (Normalfall), wird je Stück geteilt und die Menge bleibt.
 * Sonst (z. B. 1000 / 3 oder „Gesamte Location“ bei 75 Gästen) wird der Zeilenbetrag
 * round(price × quantity × 100) als Menge 1 geteilt, damit die Summe dem Zahlbetrag entspricht;
 * die Gästezahl steht dann im Namen („<Name> (75 Gäste) – Speisen“).
 * Ein Anteil von 0 € entfällt.
 */
export function splitEventPackageLine(item: { name: string; quantity: number; price: number }): SplitLine[] {
  const unitCents = Math.round(item.price * 100);
  const lineCents = Math.round(item.price * item.quantity * 100);
  const perUnit = unitCents * item.quantity === lineCents;
  const baseName = perUnit || item.quantity === 1 ? item.name : `${item.name} (${item.quantity} Gäste)`;
  const { foodCents, drinksCents } = splitEventGrossCents(perUnit ? unitCents : lineCents);
  const quantity = perUnit ? item.quantity : 1;
  const lines: SplitLine[] = [];
  if (foodCents !== 0) {
    lines.push({ name: `${baseName} – Speisen`, quantity, grossAmount: foodCents / 100, taxRatePercentage: EVENT_FOOD_VAT });
  }
  if (drinksCents !== 0) {
    lines.push({ name: `${baseName} – Getränke`, quantity, grossAmount: drinksCents / 100, taxRatePercentage: EVENT_DRINKS_VAT });
  }
  return lines;
}

/**
 * Angebots-Zahlweg: nur ein reines Event-Paket (offer_mode 'package', packages.package_type 'event')
 * ohne einzeln ausgewiesene Zusatzposten (Getränke, Weinbegleitung, Personal, Equipment) wird 70/30 geteilt.
 * Menüs, Getränkepakete und Angebote mit Zusatzposten bleiben wie bisher bei 7 %.
 */
export function shouldSplitOfferAsEventPackage(input: {
  offerMode: string | null | undefined;
  packageType: string | null | undefined;
  menuSelection: Record<string, unknown> | null | undefined;
}): boolean {
  if (input.offerMode !== "package" || input.packageType !== "event") return false;
  const ms = input.menuSelection ?? {};
  const nonEmpty = (v: unknown) => Array.isArray(v) && v.length > 0;
  if (nonEmpty(ms.equipment) || nonEmpty(ms.staff) || nonEmpty(ms.drinks) || nonEmpty(ms.drinksEinzeln)) return false;
  const mode = ms.drinksMode;
  if (mode === "pauschale" || mode === "weinbegleitung" || mode === "einzeln") return false;
  if (typeof ms.winePairingPrice === "number" && ms.winePairingPrice > 0) return false;
  if (typeof ms.drinksPauschalePrice === "number" && ms.drinksPauschalePrice > 0) return false;
  return true;
}
