/**
 * Pricing-Mode-Helpers.
 *
 * Der OfferBuilder unterstuetzt zwei Pricing-Modi:
 *
 * - 'per_person': budgetPerPerson ist der Preis pro Gast.
 *                 totalAmount wird als budgetPerPerson * guestCount berechnet.
 *                 Richtig fuer Paket-basierte Angebote (Business Dinner, Hochzeit,
 *                 klassische Event-Menues).
 *
 * - 'per_event':  budgetPerPerson wird als Gesamtpreis (fuer den ganzen Anlass,
 *                 ggfs. ueber mehrere Tage) interpretiert.
 *                 totalAmount = budgetPerPerson (keine Division durch guestCount).
 *                 Richtig fuer Catering-Bestellungen mit absoluten Mengen
 *                 (z.B. "11 x Salat"), wo der Preis pro Zeile fix ist und sich
 *                 der Gesamtpreis nicht pro Gast skalieren laesst.
 *
 * Das Feld heisst zwar "budgetPerPerson", wird aber im per_event-Modus als
 * Gesamtbetrag gelesen. Ein einziges Feld, zwei Interpretationen, abhaengig vom
 * pricingMode. Das vermeidet Drift-Zustaende zwischen zwei separaten Feldern.
 */

import type { CourseSelection } from "../MenuComposer/types";

export type PricingMode = 'per_person' | 'per_event';

/**
 * Erkennt automatisch den Pricing-Modus anhand der Kurs-Namen.
 * Wenn irgendein Kurs mit "<Zahl> x " beginnt (z.B. "11 x Salat"), ist das
 * ein starker Hinweis auf absolute Mengen (Catering-Import) und wir verwenden
 * per_event. Sonst Default per_person.
 */
export function detectPricingMode(courses: readonly CourseSelection[] | undefined): PricingMode {
  if (!courses || courses.length === 0) return 'per_person';

  const hasQuantityPrefix = courses.some(course => {
    if (!course.itemName) return false;
    return /^\d+\s*x\s/i.test(course.itemName.trim());
  });

  return hasQuantityPrefix ? 'per_event' : 'per_person';
}

/**
 * Berechnet totalAmount aus budgetPerPerson + guestCount je nach Modus.
 * - per_person: totalAmount = budgetPerPerson * guestCount
 * - per_event:  totalAmount = budgetPerPerson (1:1, keine Division)
 *
 * Falls budgetPerPerson null oder 0 ist, wird fallbackAmount zurueckgegeben
 * (z.B. die Summe aus den einzelnen Kurs-Preisen).
 */
export function calculateTotalAmount(
  pricingMode: PricingMode,
  budgetPerPerson: number | null,
  guestCount: number,
  fallbackAmount: number,
): number {
  if (budgetPerPerson == null || budgetPerPerson <= 0) {
    return fallbackAmount;
  }

  return pricingMode === 'per_event'
    ? budgetPerPerson
    : budgetPerPerson * guestCount;
}

/**
 * Zurueckrechnen: aus einem totalAmount + guestCount + Modus den Wert ableiten,
 * den wir ins budgetPerPerson-Feld schreiben muessen.
 * - per_person: totalAmount / guestCount
 * - per_event:  totalAmount (1:1)
 */
export function deriveBudgetValue(
  pricingMode: PricingMode,
  totalAmount: number,
  guestCount: number,
): number {
  if (pricingMode === 'per_event') return totalAmount;
  return guestCount > 0 ? totalAmount / guestCount : totalAmount;
}

/**
 * Human-readable Label fuer den Modus.
 */
export function pricingModeLabel(mode: PricingMode): string {
  return mode === 'per_event' ? 'pro Anlass' : 'pro Person';
}
