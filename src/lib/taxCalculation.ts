/**
 * Helper zur MwSt-Berechnung fuer Angebote.
 *
 * Deutsche MwSt-Saetze:
 * - 7 % fuer Speisen / Lebensmittel (reduzierter Satz)
 * - 19 % fuer Getraenke / Alkohol (Regelsatz)
 *
 * Die Line-Items in LexOffice werden mit den jeweiligen Saetzen angelegt.
 * Fuer Stripe-Payment und Public-Anzeige brauchen wir den Brutto-Gesamtbetrag.
 */

interface MenuSelectionTax {
  winePairingPrice?: number | null;
  drinksMode?: 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln';
  drinksPauschalePrice?: number | null;
  drinksEinzeln?: Array<{ pricePerPerson: number }>;
  pricingMode?: 'per_person' | 'per_event';
}

export interface TaxBreakdown {
  netTotal: number;
  taxAmount: number;
  grossTotal: number;
  /** Bei per_event und reinen Speisen-Angeboten: 7. Bei Mischung: gemittelter effektiver Satz. */
  effectiveTaxRate: number;
}

/**
 * Berechnet Brutto aus Netto + Menu-Selection.
 *
 * Logik:
 * - per_event: alles 7 % (pauschal fuer Catering-Bestellungen)
 * - per_person + Getraenke vorhanden: Speisen 7 % + Getraenke 19 %, aus menu_selection abgeleitet
 * - per_person ohne Getraenke: 7 %
 */
export function calculateTaxBreakdown(
  netTotal: number,
  guestCount: number,
  menuSelection: MenuSelectionTax | null | undefined,
): TaxBreakdown {
  // per_event: alles 7 %
  if (menuSelection?.pricingMode === 'per_event') {
    const taxAmount = round2(netTotal * 0.07);
    return {
      netTotal: round2(netTotal),
      taxAmount,
      grossTotal: round2(netTotal + taxAmount),
      effectiveTaxRate: 7,
    };
  }

  // Getraenke-Anteil aus menu_selection ableiten
  const drinkMode = menuSelection?.drinksMode ?? 'none';
  let drinkNetPerPerson = 0;
  if (drinkMode === 'pauschale' && menuSelection?.drinksPauschalePrice) {
    drinkNetPerPerson = menuSelection.drinksPauschalePrice;
  } else if (drinkMode === 'weinbegleitung' && menuSelection?.winePairingPrice) {
    drinkNetPerPerson = menuSelection.winePairingPrice;
  } else if (drinkMode === 'einzeln' && menuSelection?.drinksEinzeln) {
    drinkNetPerPerson = menuSelection.drinksEinzeln.reduce(
      (s, d) => s + (d.pricePerPerson || 0),
      0,
    );
  } else if (drinkMode === 'none' && menuSelection?.winePairingPrice) {
    // Legacy-Fallback
    drinkNetPerPerson = menuSelection.winePairingPrice;
  }

  const drinkNetTotal = round2(drinkNetPerPerson * guestCount);
  const foodNetTotal = round2(netTotal - drinkNetTotal);

  // Speisen 7 %, Getraenke 19 %
  const foodTax = round2(foodNetTotal * 0.07);
  const drinkTax = round2(drinkNetTotal * 0.19);
  const taxAmount = round2(foodTax + drinkTax);
  const grossTotal = round2(netTotal + taxAmount);
  const effectiveTaxRate = netTotal > 0 ? (taxAmount / netTotal) * 100 : 7;

  return {
    netTotal: round2(netTotal),
    taxAmount,
    grossTotal,
    effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
