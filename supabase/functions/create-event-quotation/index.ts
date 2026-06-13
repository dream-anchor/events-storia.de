import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  loadBusinessData,
  resolveLocationAddress,
  resolveBillingAddress,
  formatLocationOneLine,
} from '../_shared/addressResolver.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseSelectionDB {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
  overridePrice?: number | null;
  /** Menge (quantity); bei Zeilen-Total = quantity * overridePrice */
  quantity?: number | null;
}

interface DrinkSelectionDB {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
  customDrink?: string | null;
}

interface DrinkEinzelnItemDB {
  id: string;
  name: string;
  pricePerPerson: number;
  /** Menge bei per_event. Zeilen-Total = quantity * pricePerPerson. */
  quantity?: number | null;
}

interface EquipmentItemDB {
  id: string;
  name: string;
  pricePerUnit: number;
  quantity: number;
}

interface MenuSelectionDB {
  courses?: CourseSelectionDB[];
  drinks?: DrinkSelectionDB[];
  winePairingPrice?: number | null;
  budgetPerPerson?: number | null;
  packageNameOverride?: string | null;
  /** 'per_person' (Default) oder 'per_event' (Gesamtpreis für Anlass) */
  pricingMode?: 'per_person' | 'per_event';
  drinksMode?: 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln';
  drinksPauschalePrice?: number | null;
  drinksPauschaleDescription?: string | null;
  drinksEinzeln?: DrinkEinzelnItemDB[];
  equipment?: EquipmentItemDB[];
  staff?: EquipmentItemDB[];
  /** Optionaler Rabatt in Prozent (z. B. 10 = 10 %). */
  discountPercent?: number | null;
  /** Optionaler Rabatt als fester Brutto-Eurobetrag. */
  discountAmount?: number | null;
}

interface OfferOption {
  offer_mode: string;
  total_amount: number;
  guest_count: number;
  package_id: string | null;
  menu_selection: MenuSelectionDB | null;
}

interface LexOfficeLineItem {
  type: 'custom';
  name: string;
  description: string;
  quantity: number;
  unitName: string;
  unitPrice: {
    currency: 'EUR';
    grossAmount?: number;
    netAmount?: number;
    taxRatePercentage: number;
  };
  /** Nur fuer parent-LineItems: Alternativpositionen (Lex-API: alternative=true). */
  subItems?: LexOfficeLineItem[];
  /** Nur fuer subItems gueltig; muss true sein, sonst von API abgelehnt. */
  alternative?: boolean;
}

// ─── Line-item builder ────────────────────────────────────────────────────────
// WICHTIG: Maestro-Admin gibt IMMER Brutto-Preise ein. LexOffice unterstuetzt
// nativ Brutto-Eingabe via taxConditions.taxType='gross' + unitPrice.grossAmount.
// LexOffice rechnet die enthaltene MwSt automatisch heraus. Keine manuelle
// Brutto->Netto-Konvertierung mehr noetig (vermeidet Cent-Rundungsfehler).

const FOOD_TAX_RATE = 7;
const DRINK_TAX_RATE = 19;

/**
 * Hängt — sofern in `menu_selection` ein Rabatt konfiguriert ist — eine
 * negative LexOffice-Position pro Steuersatz an, sodass die Summe der
 * LineItems exakt `targetTotal` (Brutto) ergibt. Die Einzelpreise der
 * vorhandenen LineItems bleiben dabei unverändert (1:1 wie im Public Offer).
 *
 * Verteilung:
 *   - `discountPercent` hat Vorrang vor `discountAmount`.
 *   - Der Brutto-Rabatt wird proportional auf die vorhandenen Steuersätze
 *     (7 % Speisen, 19 % Getränke/Equipment/Staff) verteilt.
 *   - Restcent-Differenzen aus Rundung landen auf der letzten Rabattzeile,
 *     damit der Brutto-Gesamtbetrag exakt mit Maestro übereinstimmt.
 */
function appendDiscountLines(
  items: LexOfficeLineItem[],
  targetTotal: number,
  discountPercent: number | null,
  discountAmount: number | null,
): void {
  if (items.length === 0) return;

  const grossByRate: Record<number, number> = {};
  for (const i of items) {
    const r = i.unitPrice.taxRatePercentage;
    grossByRate[r] = (grossByRate[r] || 0) + i.unitPrice.grossAmount * i.quantity;
  }
  const rawTotal = Object.values(grossByRate).reduce((s, v) => s + v, 0);
  const targetRounded = Math.round(targetTotal * 100) / 100;
  const totalDiscount = Math.round((rawTotal - targetRounded) * 100) / 100;
  if (totalDiscount <= 0.005) return;

  const label = discountPercent != null && discountPercent > 0
    ? `Rabatt ${Number.isInteger(discountPercent) ? discountPercent : discountPercent.toFixed(1).replace('.', ',')} %`
    : 'Rabatt';

  // Steuersätze in stabiler Reihenfolge (zuerst Speisen 7 %, dann Getränke 19 %)
  const rates = Object.keys(grossByRate)
    .map(Number)
    .filter(r => (grossByRate[r] || 0) > 0)
    .sort((a, b) => a - b);
  if (rates.length === 0) return;

  const totalGross = rates.reduce((s, r) => s + grossByRate[r], 0);
  const allocations: { rate: number; amount: number }[] = [];
  let allocated = 0;
  for (let idx = 0; idx < rates.length; idx++) {
    const rate = rates[idx];
    let amount: number;
    if (idx === rates.length - 1) {
      // Letzte Position bekommt den Rest, damit Cent-Differenzen aufgehen
      amount = Math.round((totalDiscount - allocated) * 100) / 100;
    } else {
      amount = Math.round((totalDiscount * (grossByRate[rate] / totalGross)) * 100) / 100;
      allocated += amount;
    }
    if (amount > 0) allocations.push({ rate, amount });
  }

  const rateLabel = (r: number) => r === FOOD_TAX_RATE ? 'Speisen' : (r === DRINK_TAX_RATE ? 'Getränke/Equipment' : `${r} %`);
  const showSplitLabel = allocations.length > 1;

  for (const a of allocations) {
    items.push({
      type: 'custom',
      name: showSplitLabel ? `${label} (${rateLabel(a.rate)})` : label,
      description: '',
      quantity: 1,
      unitName: 'Pauschale',
      unitPrice: {
        currency: 'EUR',
        grossAmount: -a.amount,
        taxRatePercentage: a.rate,
      },
    });
  }
}

/**
 * Sammelt eine Liste aller konfigurierten Getränke einer Option als Strings für
 * die LexOffice-Beschreibung. Deckt sowohl das Legacy-`drinks[]`-Array
 * (Paket-Konfiguration: Wasser, Kaffee, Hauptgetränk …) als auch den neuen
 * `drinksMode` (pauschale | weinbegleitung | einzeln) ab.
 *
 * Wird überall genutzt, wo Getränke nicht als eigene Position auftauchen
 * (Paket-Modus, E-Mail-Modus, Variant-Beschreibung). So gehen Getränke nie
 * verloren — egal welcher Pfad/Modus aktiv ist.
 */
function buildDrinkInfoLines(ms: MenuSelectionDB | null | undefined): string[] {
  if (!ms) return [];
  const lines: string[] = [];

  // 1. Legacy: drinks[] (Paket-Konfig: Wasser, Kaffee, Hauptgetränk-Auswahl)
  for (const d of (ms.drinks || [])) {
    const choice = d.selectedChoice || d.customDrink || '';
    const label = d.drinkLabel || '';
    if (!label && !choice) continue;
    const qty = d.quantityLabel ? ` (${d.quantityLabel})` : '';
    lines.push(choice ? `${label}: ${choice}${qty}` : `${label}${qty}`);
  }

  // 2. Neuer drinksMode
  const mode = ms.drinksMode ?? 'none';
  if (mode === 'pauschale') {
    const desc = ms.drinksPauschaleDescription || 'Getränkepauschale';
    const price = ms.drinksPauschalePrice ?? 0;
    if (desc) {
      lines.push(price > 0
        ? `${desc} (${price.toFixed(2).replace('.', ',')} € / Pers.)`
        : `${desc} (inklusive)`);
    }
  } else if (mode === 'weinbegleitung') {
    const price = ms.winePairingPrice ?? 0;
    lines.push(price > 0
      ? `Weinbegleitung (${price.toFixed(2).replace('.', ',')} € / Pers.)`
      : `Weinbegleitung (inklusive)`);
  } else if (mode === 'einzeln' && ms.drinksEinzeln?.length) {
    for (const d of ms.drinksEinzeln) {
      if (!d.name) continue;
      const qty = d.quantity ?? 1;
      const baseName = qty > 1 ? `${qty} × ${d.name}` : d.name;
      const price = d.pricePerPerson ?? 0;
      lines.push(price > 0
        ? `${baseName} (${price.toFixed(2).replace('.', ',')} € / Pers.)`
        : `${baseName} (inklusive)`);
    }
  } else if (mode === 'none' && (ms.winePairingPrice ?? 0) > 0) {
    lines.push(`Weinbegleitung (${(ms.winePairingPrice ?? 0).toFixed(2).replace('.', ',')} € / Pers.)`);
  }

  return lines;
}

function buildLineItems(
  opt: OfferOption,
  packageName: string | null,
  guestOverride?: number,
): LexOfficeLineItem[] {
  const ms = opt.menu_selection;
  const guestCount = guestOverride && guestOverride > 0
    ? guestOverride
    : (parseInt(String(opt.guest_count)) || 1);
  const totalAmount = opt.total_amount || 0;
  const items: LexOfficeLineItem[] = [];

  // Pricing-Modus per_event: Positionen mit korrektem MwSt-Split.
  // Alle overridePrice-/pricePerPerson-Werte sind BRUTTO. Wir geben sie
  // direkt als grossAmount an LexOffice; LexOffice rechnet enthaltene MwSt
  // heraus (7% Speisen / 19% Getraenke). Jede Speise/Getraenk = eine Zeile.
  if (ms?.pricingMode === 'per_event') {
    const FOOD_TAX = FOOD_TAX_RATE;
    const DRINK_TAX = DRINK_TAX_RATE;

    // Eintrag mit echter Menge + Einzelpreis (Brutto). Wird unten 1:1 als
    // LexOffice-Position ausgegeben — damit der Beleg "3 × Vitello 52 € = 156 €"
    // statt einer Sammelzeile zeigt (entspricht der Maestro-Anzeige).
    type BruttoEntry = {
      name: string;
      description: string;
      qty: number;
      unitBrutto: number;
      tax: number;
      unitName: string;
      fixed: boolean; // true = nicht skalieren (Equipment/Staff)
    };
    const entries: BruttoEntry[] = [];

    // --- Speisen: eine Zeile pro Gericht ---
    for (const c of (ms.courses || [])) {
      if (!c.itemName || c.overridePrice == null || c.overridePrice <= 0) continue;
      const qty = Math.max(1, c.quantity ?? 1);
      const unitBrutto = round2(c.overridePrice || 0);
      if (unitBrutto <= 0) continue;
      entries.push({
        name: c.itemName,
        description: c.itemDescription || '',
        qty,
        unitBrutto,
        tax: FOOD_TAX,
        unitName: 'Portion',
        fixed: false,
      });
    }

    // --- Getränke ---
    const drinkMode = ms.drinksMode ?? 'none';
    if (drinkMode === 'einzeln' && ms.drinksEinzeln) {
      for (const d of ms.drinksEinzeln) {
        if (!d.name || d.pricePerPerson <= 0) continue;
        const qty = Math.max(1, d.quantity ?? 1);
        entries.push({
          name: d.name,
          description: '',
          qty,
          unitBrutto: round2(d.pricePerPerson),
          tax: DRINK_TAX,
          unitName: 'Stk',
          fixed: false,
        });
      }
    } else if (drinkMode === 'pauschale' && ms.drinksPauschalePrice && ms.drinksPauschalePrice > 0) {
      entries.push({
        name: ms.drinksPauschaleDescription || 'Getränkepauschale',
        description: '',
        qty: 1,
        unitBrutto: round2(ms.drinksPauschalePrice),
        tax: DRINK_TAX,
        unitName: 'Pauschale',
        fixed: false,
      });
    } else if ((drinkMode === 'weinbegleitung' || drinkMode === 'none') && ms.winePairingPrice && ms.winePairingPrice > 0) {
      entries.push({
        name: 'Weinbegleitung',
        description: '',
        qty: 1,
        unitBrutto: round2(ms.winePairingPrice),
        tax: DRINK_TAX,
        unitName: 'Pauschale',
        fixed: false,
      });
    }

    // --- Equipment / Personal: Fixkosten ---
    for (const eq of (ms.equipment || [])) {
      if (!eq.name || eq.pricePerUnit <= 0 || eq.quantity <= 0) continue;
      entries.push({
        name: eq.name, description: '', qty: eq.quantity,
        unitBrutto: round2(eq.pricePerUnit), tax: DRINK_TAX, unitName: 'Stk', fixed: true,
      });
    }
    for (const st of (ms.staff || [])) {
      if (!st.name || st.pricePerUnit <= 0 || st.quantity <= 0) continue;
      entries.push({
        name: st.name, description: '', qty: st.quantity,
        unitBrutto: round2(st.pricePerUnit), tax: DRINK_TAX, unitName: 'Stk', fixed: true,
      });
    }

    // --- Proportionale Korrektur (nur skalierbare Einträge) ---
    // Hinweis: Einzelpreise bleiben 1:1 wie in Maestro/Angebot eingetragen
    // (Brutto). Eine eventuelle Rabatt-Differenz wird unten als eigene
    // Rabattzeile pro Steuersatz ausgewiesen — der Kunde sieht in LexOffice
    // exakt die gleichen Einzelpreise wie im Public Offer.

    for (const e of entries) {
      if (e.unitBrutto <= 0 || e.qty <= 0) continue;
      items.push({
        type: 'custom',
        name: e.name,
        description: e.description,
        quantity: e.qty,
        unitName: e.unitName,
        unitPrice: {
          currency: 'EUR',
          grossAmount: e.unitBrutto,
          taxRatePercentage: e.tax,
        },
      });
    }

    if (items.length === 0) {
      items.push({
        type: 'custom',
        name: opt.offer_mode === 'menu' ? 'Catering-Bestellung' : (packageName || 'Veranstaltungspaket'),
        description: '',
        quantity: 1,
        unitName: 'Stk',
        unitPrice: { currency: 'EUR', grossAmount: round2(totalAmount), taxRatePercentage: FOOD_TAX },
      });
    }

    appendDiscountLines(items, totalAmount, ms?.discountPercent ?? null, ms?.discountAmount ?? null);
    return items;
  }

  if (opt.offer_mode === 'menu' && ms?.courses && ms.courses.length > 0) {
    const courses = ms.courses.filter(c => c.itemName);
    const winePricePerPerson = ms.winePairingPrice ?? 0;

    // Try to use per-course overridePrice if set
    const hasOverridePrices = courses.some(
      c => c.overridePrice != null && c.overridePrice > 0,
    );

    if (hasOverridePrices) {
      for (const course of courses) {
        const price = course.overridePrice != null && course.overridePrice > 0
          ? course.overridePrice
          : 0;
        if (price === 0) continue;
        items.push({
          type: 'custom',
          name: `${course.courseLabel}: ${course.itemName}`,
          description: course.itemDescription || '',
          quantity: 1,
          unitName: 'Person',
          unitPrice: {
            currency: 'EUR',
            grossAmount: price,
            taxRatePercentage: 7,
          },
        });
      }
    } else {
      // No individual prices — distribute total evenly across courses (Brutto)
      const wineTotalBrutto = winePricePerPerson * guestCount;
      const courseTotalBrutto = totalAmount - wineTotalBrutto;
      const pricePerCourseGross = courses.length > 0
        ? round2(courseTotalBrutto / courses.length / guestCount)
        : 0;

      for (const course of courses) {
        items.push({
          type: 'custom',
          name: `${course.courseLabel}: ${course.itemName}`,
          description: course.itemDescription || '',
          quantity: 1,
          unitName: 'Person',
          unitPrice: {
            currency: 'EUR',
            grossAmount: pricePerCourseGross,
            taxRatePercentage: 7,
          },
        });
      }
    }

    // Getränke: je nach drinksMode eigene Positionen
    const drinkMode = ms.drinksMode ?? 'none';

    if (drinkMode === 'pauschale' && ms.drinksPauschalePrice && ms.drinksPauschalePrice > 0) {
      items.push({
        type: 'custom',
        name: ms.drinksPauschaleDescription || 'Getränkepauschale',
        description: '',
        quantity: 1,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          grossAmount: ms.drinksPauschalePrice,
          taxRatePercentage: 19,
        },
      });
    } else if (drinkMode === 'weinbegleitung' && ms.winePairingPrice && ms.winePairingPrice > 0) {
      items.push({
        type: 'custom',
        name: 'Weinbegleitung zum Menü',
        description: '',
        quantity: 1,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          grossAmount: ms.winePairingPrice,
          taxRatePercentage: 19,
        },
      });
    } else if (drinkMode === 'einzeln' && ms.drinksEinzeln && ms.drinksEinzeln.length > 0) {
      for (const drink of ms.drinksEinzeln) {
        if (drink.pricePerPerson > 0) {
          items.push({
            type: 'custom',
            name: drink.name,
            description: '',
            quantity: 1,
            unitName: 'Person',
            unitPrice: {
              currency: 'EUR',
              grossAmount: drink.pricePerPerson,
              taxRatePercentage: 19,
            },
          });
        }
      }
    } else if ((drinkMode === 'none' || !drinkMode) && winePricePerPerson > 0) {
      // Fallback: Altes Verhalten (winePairingPrice direkt gesetzt ohne neuen Modus)
      const drinkLabels = (ms.drinks || [])
        .map(d => d.drinkLabel + (d.selectedChoice ? `: ${d.selectedChoice}` : ''))
        .join(', ');
      items.push({
        type: 'custom',
        name: 'Getränkebegleitung',
        description: drinkLabels,
        quantity: 1,
        unitName: 'Person',
        unitPrice: {
          currency: 'EUR',
          grossAmount: winePricePerPerson,
          taxRatePercentage: 19,
        },
      });
    }

    // --- Equipment (19% MwSt, als Fixposition nicht pro Person) ---
    for (const eq of (ms.equipment || [])) {
      if (!eq.name || eq.pricePerUnit <= 0 || eq.quantity <= 0) continue;
      items.push({
        type: 'custom',
        name: eq.name,
        description: '',
        quantity: eq.quantity,
        unitName: 'Stk',
        unitPrice: { currency: 'EUR', grossAmount: round2(eq.pricePerUnit), taxRatePercentage: 19 },
      });
    }

    // --- Personal (19% MwSt, als Fixposition nicht pro Person) ---
    for (const st of (ms.staff || [])) {
      if (!st.name || st.pricePerUnit <= 0 || st.quantity <= 0) continue;
      items.push({
        type: 'custom',
        name: st.name,
        description: '',
        quantity: st.quantity,
        unitName: 'Stk',
        unitPrice: { currency: 'EUR', grossAmount: round2(st.pricePerUnit), taxRatePercentage: 19 },
      });
    }

    // Multiplikation: Zwischensummen + (guestCount-1) für korrekte Gesamtsumme (Brutto)
    if (guestCount > 1 && items.length > 0) {
      // Equipment/Staff (unitName 'Stk') sind Fixpositionen — NICHT mit Gästezahl multiplizieren
      const perPersonItems = items.filter(i => i.unitName !== 'Stk');
      const foodTotal = round2(perPersonItems
        .filter(i => i.unitPrice.taxRatePercentage === 7)
        .reduce((s, i) => s + i.unitPrice.grossAmount * i.quantity, 0));
      const drinkTotal = round2(perPersonItems
        .filter(i => i.unitPrice.taxRatePercentage === 19)
        .reduce((s, i) => s + i.unitPrice.grossAmount * i.quantity, 0));

      if (foodTotal > 0) {
        items.push({
          type: 'custom',
          name: 'Menü pro Person (brutto)',
          description: '',
          quantity: 1,
          unitName: 'Stück',
          unitPrice: { currency: 'EUR', grossAmount: foodTotal, taxRatePercentage: 7 },
        });
        items.push({
          type: 'custom',
          name: `Speisen × ${guestCount} Personen`,
          description: '',
          quantity: guestCount - 1,
          unitName: 'Person',
          unitPrice: { currency: 'EUR', grossAmount: foodTotal, taxRatePercentage: 7 },
        });
      }
      if (drinkTotal > 0) {
        items.push({
          type: 'custom',
          name: 'Getränke pro Person (brutto)',
          description: '',
          quantity: 1,
          unitName: 'Stück',
          unitPrice: { currency: 'EUR', grossAmount: drinkTotal, taxRatePercentage: 19 },
        });
        items.push({
          type: 'custom',
          name: `Getränke × ${guestCount} Personen`,
          description: '',
          quantity: guestCount - 1,
          unitName: 'Person',
          unitPrice: { currency: 'EUR', grossAmount: drinkTotal, taxRatePercentage: 19 },
        });
      }
    }
  } else {
    // Paket-Modus oder E-Mail-Modus: eine Gesamtposition
    // totalAmount ist BRUTTO (Maestro-Eingabe) — direkt als grossAmount durchreichen.
    // Equipment/Staff-Kosten vom Gesamtpreis abziehen für die Pro-Person-Berechnung
    const equipStaffTotal = round2(
      ((ms?.equipment || []).filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0).reduce((s, e) => s + e.pricePerUnit * e.quantity, 0)) +
      ((ms?.staff || []).filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0).reduce((s, e) => s + e.pricePerUnit * e.quantity, 0))
    );
    const packageTotal = round2(totalAmount - equipStaffTotal);
    // Pro-Person-Preis: bevorzugt aus budgetPerPerson (= echter Paket-Preis aus UI),
    // damit der Beleg die im UI sichtbare Zahl spiegelt (z. B. 69 €) und nicht durch
    // historische overridePrice-Aufschläge verzerrt wird. Fallback: Summe / Gäste.
    const unitPriceBrutto = (ms?.budgetPerPerson != null && ms.budgetPerPerson > 0)
      ? round2(ms.budgetPerPerson)
      : (guestCount > 0 ? round2(packageTotal / guestCount) : 0);

    // Beschreibung: enthaltene Speisen & Getränke auflisten (wie in MAESTRO sichtbar).
    const inclLines: string[] = [];
    for (const c of (ms?.courses || [])) {
      if (!c.itemName) continue;
      const label = c.courseLabel ? `${c.courseLabel}: ` : '';
      inclLines.push(`• ${label}${c.itemName}`);
    }
    for (const drinkLine of buildDrinkInfoLines(ms)) {
      inclLines.push(`• ${drinkLine}`);
    }
    const description = inclLines.length > 0
      ? `Inklusive:\n${inclLines.join('\n')}`
      : '';

    items.push({
      type: 'custom',
      name: packageName || 'Veranstaltungspaket',
      description,
      quantity: guestCount,
      unitName: 'Person',
      unitPrice: {
        currency: 'EUR',
        grossAmount: unitPriceBrutto,
        taxRatePercentage: 7,
      },
    });

    // --- Equipment (19% MwSt, Fixposition) ---
    for (const eq of (ms?.equipment || [])) {
      if (!eq.name || eq.pricePerUnit <= 0 || eq.quantity <= 0) continue;
      items.push({
        type: 'custom',
        name: eq.name,
        description: '',
        quantity: eq.quantity,
        unitName: 'Stk',
        unitPrice: { currency: 'EUR', grossAmount: round2(eq.pricePerUnit), taxRatePercentage: 19 },
      });
    }

    // --- Personal (19% MwSt, Fixposition) ---
    for (const st of (ms?.staff || [])) {
      if (!st.name || st.pricePerUnit <= 0 || st.quantity <= 0) continue;
      items.push({
        type: 'custom',
        name: st.name,
        description: '',
        quantity: st.quantity,
        unitName: 'Stk',
        unitPrice: { currency: 'EUR', grossAmount: round2(st.pricePerUnit), taxRatePercentage: 19 },
      });
    }
  }

  appendDiscountLines(items, totalAmount, ms?.discountPercent ?? null, ms?.discountAmount ?? null);
  return items;
}

function formatDateDE(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

// ─── Alternativ-Varianten (Multi-Option-Angebote) ─────────────────────────────
// Lexware-API erlaubt `subItems[].alternative=true` als „OR"-Position. Bei
// mehreren aktiven Angebots-Optionen ohne Kundenauswahl wird die erste Option
// zum parent, die restlichen zu Alternative-Sub-Items.

function formatEUR(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

function labelForMode(offerMode: string): string {
  if (offerMode === 'menu') return 'Catering-Bestellung';
  return 'Veranstaltungspaket';
}

/**
 * Steuersatz aus den Detail-Items einer Variante ableiten.
 * - alle Items selber Satz → diesen verwenden
 * - gemischt → dominierender Satz nach Brutto-Anteil
 * - leer (Fallback) → 7 % (Catering-Standard)
 */
function deriveTaxRate(items: LexOfficeLineItem[]): number {
  if (items.length === 0) return FOOD_TAX_RATE;
  const sumByRate: Record<number, number> = {};
  for (const i of items) {
    const r = i.unitPrice.taxRatePercentage;
    sumByRate[r] = (sumByRate[r] || 0) + i.unitPrice.grossAmount * i.quantity;
  }
  const rates = Object.keys(sumByRate);
  if (rates.length === 1) return Number(rates[0]);
  return (sumByRate[DRINK_TAX_RATE] || 0) > (sumByRate[FOOD_TAX_RATE] || 0)
    ? DRINK_TAX_RATE
    : FOOD_TAX_RATE;
}

/**
 * Konsolidiert eine Angebots-Option zu einer einzigen LexOffice-LineItem.
 * Detail-Items wandern in `description`; Brutto-Gesamt und Steuersatz werden
 * aus den Detail-Items abgeleitet (kein Hardcoding).
 */
function buildVariantLineItem(
  opt: OfferOption,
  packageName: string | null,
  guestOverride?: number,
): LexOfficeLineItem {
  const detailItems = buildLineItems(opt, packageName, guestOverride);
  const total = round2(
    detailItems.reduce((s, i) => s + i.unitPrice.grossAmount * i.quantity, 0),
  );
  const description = detailItems
    .map((i) => {
      const lineTotal = round2(i.unitPrice.grossAmount * i.quantity);
      const qty = i.quantity > 1 ? `${i.quantity} × ` : '';
      return `- ${qty}${i.name}: ${formatEUR(lineTotal)}`;
    })
    .join('\n');
  const taxRate = deriveTaxRate(detailItems);
  return {
    type: 'custom',
    name: packageName || labelForMode(opt.offer_mode),
    description,
    quantity: 1,
    unitName: 'Pauschale',
    unitPrice: {
      currency: 'EUR',
      grossAmount: total > 0 ? total : round2(opt.total_amount || 0),
      taxRatePercentage: taxRate,
    },
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildIntroduction(
  inquiry: Record<string, unknown> | null,
  ms: MenuSelectionDB | null,
  locationLine: string | null,
  opts?: { isInvoiceMode?: boolean; isFinalInvoice?: boolean },
): string {
  // Hinweis: Speisen/Getraenke werden hier NICHT mehr aufgelistet (jetzt Line-Items).
  void ms;
  const rawDate = inquiry?.preferred_date ? String(inquiry.preferred_date) : null;
  const dateLabel = rawDate ? formatDateDE(rawDate) : 'nach Vereinbarung';
  const titlePrefix = opts?.isFinalInvoice || opts?.isInvoiceMode
    ? 'Event-Rechnung'
    : 'Event-Angebot';
  const parts = [
    `${titlePrefix} für den ${dateLabel}`,
    `Gäste: ${inquiry?.guest_count || '-'} Personen`,
    `Art: ${inquiry?.event_type ? capitalize(String(inquiry.event_type)) : '-'}`,
  ];
  if (locationLine) parts.push(`Veranstaltungsort: ${locationLine}`);
  return parts.join('\n');
}

function buildPaymentConditions(
  depositPercent: number,
  depositDueDays: number,
  fixedDepositAmount?: number | null,
): { paymentTermLabel: string; paymentTermDuration: number } {
  const paymentTermDuration = Math.max(1, depositDueDays || 1);

  if (fixedDepositAmount != null && fixedDepositAmount > 0) {
    return {
      paymentTermLabel: `Anzahlung ${fixedDepositAmount.toFixed(2)} € innerhalb von ${paymentTermDuration} Tagen`,
      paymentTermDuration,
    };
  }

  if (depositPercent === 0) {
    return {
      paymentTermLabel: 'Zahlung vollständig bei Auftragserteilung',
      paymentTermDuration,
    };
  }

  if (depositPercent === 100) {
    return {
      paymentTermLabel: `Vorauszahlung 100% innerhalb von ${paymentTermDuration} Tagen ab Rechnungsdatum`,
      paymentTermDuration,
    };
  }

  return {
    paymentTermLabel: `Anzahlung ${depositPercent}% innerhalb von ${paymentTermDuration} Tagen`,
    paymentTermDuration,
  };
}

function buildRemarkText(depositPercent: number, offerValidityDays: number): string {
  if (depositPercent === 0) {
    return `Dieses Angebot ist ${offerValidityDays} Tage gültig.`;
  }

  return `Restzahlung vor Veranstaltung. Dieses Angebot ist ${offerValidityDays} Tage gültig.`;
}

// Spiegelt 1:1 die Admin-Zusammenfassung aus PaymentTermsBlock.tsx wider,
// damit der Satz unter dem Angebots-PDF identisch zum Admin-Angebot ist.
type DepositMethodKind = 'none' | 'stripe' | 'on_site' | 'invoice';
type BalanceMethodKind = 'stripe_prepay' | 'on_site' | 'invoice_before' | 'invoice_after';

function legacyMethodPair(pm: string | null | undefined): { deposit: DepositMethodKind; balance: BalanceMethodKind } {
  switch (pm) {
    case 'deposit_online':    return { deposit: 'stripe', balance: 'stripe_prepay' };
    case 'prepayment_online': return { deposit: 'none',   balance: 'stripe_prepay' };
    case 'on_site':           return { deposit: 'none',   balance: 'on_site' };
    case 'invoice_after':     return { deposit: 'none',   balance: 'invoice_after' };
    case 'invoice_before':    return { deposit: 'none',   balance: 'invoice_before' };
    default:                  return { deposit: 'stripe', balance: 'stripe_prepay' };
  }
}

function daysLabel(n: number): string {
  return n === 1 ? '1 Tag' : `${n} Tage`;
}

function buildOfferRemark(args: {
  depositMethod: DepositMethodKind;
  balanceMethod: BalanceMethodKind;
  depositPercent: number;
  depositAmount?: number | null;
  depositDueDays: number;
  balanceDueDaysBeforeEvent: number;
  invoiceDueDays: number;
  offerValidityDays: number;
}): string {
  const {
    depositMethod: dMethod, balanceMethod: bMethod,
    depositPercent: dp, depositAmount, depositDueDays: dd,
    balanceDueDaysBeforeEvent: bDays, invoiceDueDays: invDays,
    offerValidityDays: ov,
  } = args;

  const depositMode: 'percent' | 'amount' = (depositAmount != null && depositAmount > 0) ? 'amount' : 'percent';
  const showDepositFrist = dMethod === 'stripe' || dMethod === 'invoice';

  const depositText = dMethod === 'none' ? null : (() => {
    const amountStr = depositMode === 'amount'
      ? `${(depositAmount as number).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : `${dp} %`;
    const channel = dMethod === 'stripe' ? 'per Stripe' : dMethod === 'on_site' ? 'vor Ort' : 'per Rechnung';
    const frist = showDepositFrist ? ` innerhalb ${daysLabel(dd)}` : '';
    return `Anzahlung ${amountStr} ${channel}${frist}`;
  })();

  const balanceText = bMethod === 'stripe_prepay'
    ? `Restzahlung per Stripe (${daysLabel(bDays)} vor Event)`
    : bMethod === 'on_site'
    ? `Restzahlung vor Ort beim Event`
    : bMethod === 'invoice_before'
    ? `Restzahlung per Rechnung vor Event (Zahlung bis ${daysLabel(bDays)} vor Event)`
    : `Restzahlung per Rechnung nach Event (Zahlungsziel ${daysLabel(invDays)})`;

  return `${depositText ? depositText + ', ' : ''}${balanceText}. Angebot ${daysLabel(ov)} gültig.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// HINWEIS: Früher wurden Brutto-LineItems hier manuell in Netto umgerechnet
// (gross / 1.07 → round2 → netAmount) und mit taxType='net' gesendet.
// Das verursacht Rundungsdrift auf der Brutto-Summe (z. B. 25.000 € →
// 25.001,25 €) und verletzt die Maestro-Regel „Preise 1:1, niemals
// konvertieren". Wir senden jetzt `grossAmount` zusammen mit
// taxType='gross' direkt — LexOffice rechnet intern korrekt zurück.

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      inquiryId,
      useSelectedQuantity,
      forceDocumentType,
      // NEU: für Schlussrechnung — Liste der vorausgegangenen
      // Anzahlungsrechnungen, die abgezogen werden müssen (§ 14 Abs. 5 UStG).
      // Jeder Eintrag erzeugt eine negative Brutto-Line-Item.
      downPaymentDeductions,
      // NEU: wenn true, wird der erzeugte Voucher in
      // v2_events.final_lexoffice_invoice_id gespeichert (Schlussrechnung)
      // statt in lexoffice_invoice_id (regulärer Beleg).
      isFinalInvoice,
    } = await req.json();
    if (!inquiryId) throw new Error('inquiryId fehlt');

    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) throw new Error('LEXOFFICE_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Anfrage laden
    const { data: inquiry, error: inqErr } = await supabase
      .from('event_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single();
    if (inqErr || !inquiry) throw new Error(`Anfrage nicht gefunden: ${inqErr?.message}`);

    // 2. Aktive Angebots-Optionen laden
    const { data: options, error: optErr } = await supabase
      .from('inquiry_offer_options')
      .select('offer_mode, total_amount, guest_count, selected_quantity, package_id, menu_selection')
      .eq('inquiry_id', inquiryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (optErr) throw new Error(`Optionen nicht geladen: ${optErr.message}`);

    let workingOptions = options || [];
    if (useSelectedQuantity) {
      workingOptions = workingOptions.filter(
        (o: { selected_quantity?: number | null }) =>
          // NULL/undefined = keine Auswahlmenge nötig (full_menu, email,
          // Einzeloption) → behalten. 0 = explizit abgewählt im
          // Paket-Radio-Modus → entfernen.
          o.selected_quantity == null || o.selected_quantity > 0,
      );
    }

    if (workingOptions.length === 0) {
      throw new Error('Keine aktiven Angebots-Optionen gefunden');
    }

    // ── Freshness-Check ─────────────────────────────────────────────────────
    // Wenn bereits ein LexOffice-Angebot existiert: vergleichen, ob der dort
    // gespeicherte Brutto-Gesamtbetrag noch zum aktuellen Stand der
    // inquiry_offer_options passt. Bei Differenz: altes Draft-Angebot in
    // LexOffice loeschen (best effort) und neu erzeugen.
    const isInvoiceModeEarly = forceDocumentType === 'invoice' || forceDocumentType === 'order';
    const existingQuotationId = (inquiry as Record<string, unknown>).lexoffice_quotation_id as string | null;
    if (!isInvoiceModeEarly && existingQuotationId) {
      try {
        const probe = await fetch(`https://api.lexoffice.io/v1/quotations/${existingQuotationId}`, {
          headers: { Authorization: `Bearer ${lexofficeApiKey}`, Accept: 'application/json' },
        });
        if (probe.ok) {
          const doc = await probe.json();
          const lexTotal = round2(Number(doc?.totalPrice?.totalGrossAmount ?? 0));
          const dbTotal = round2(
            (workingOptions as Array<{ total_amount?: number | null; selected_quantity?: number | null }>).reduce(
              (s, o) => s + Number(o.total_amount ?? 0),
              0,
            ),
          );
          // Erwarteten Remark-Text aus aktuellen Inquiry-Zahlungsfeldern berechnen,
          // damit ein reiner Wechsel der Zahlungskonditionen ohne Preisänderung
          // (z. B. Anzahlung 20 % → 30 %, Restzahlung-Methode, Gültigkeit) ebenfalls
          // einen Refresh des LexOffice-Angebots auslöst.
          const inqEarly = inquiry as Record<string, unknown>;
          let dpEarly = inqEarly.deposit_percent as number | null | undefined;
          let ddEarly = inqEarly.deposit_due_days as number | null | undefined;
          let ovEarly = inqEarly.offer_validity_days as number | null | undefined;
          if (dpEarly == null || ddEarly == null || ovEarly == null) {
            const { data: settings } = await supabase
              .from('site_settings')
              .select('value')
              .eq('key', 'default_payment_terms')
              .maybeSingle();
            const defaults = (settings?.value || {}) as {
              deposit_percent?: number; deposit_due_days?: number; offer_validity_days?: number;
            };
            if (dpEarly == null) dpEarly = defaults.deposit_percent ?? 20;
            if (ddEarly == null) ddEarly = defaults.deposit_due_days ?? 5;
            if (ovEarly == null) ovEarly = defaults.offer_validity_days ?? 14;
          }
          const pairEarly = legacyMethodPair(inqEarly.payment_method as string | null);
          const dMethodEarly = ((inqEarly.deposit_method as string | null) ?? pairEarly.deposit) as DepositMethodKind;
          const bMethodEarly = ((inqEarly.balance_method as string | null) ?? pairEarly.balance) as BalanceMethodKind;
          // Hinweis: Wir senden für Angebote bewusst nur den Schlusssatz als
          // remark (LexOffice-Default wird sonst angehängt). Die eigentlichen
          // Zahlungsbedingungen stehen im paymentTermLabel.
          const expectedRemark =
            'Wir freuen uns auf Ihre Auftragserteilung und sichern eine einwandfreie Ausführung zu.';
          const lexRemark = String(doc?.remark ?? '').trim();
          const totalsMatch = lexTotal > 0 && Math.abs(lexTotal - dbTotal) <= 0.01;
          const remarkMatches = lexRemark === expectedRemark;
          const lexTaxType = String(doc?.taxConditions?.taxType ?? '');
          const taxTypeMatches = lexTaxType === 'net';
          if (totalsMatch && remarkMatches && taxTypeMatches) {
            // PDF in LexOffice ist aktuell — nichts neu erzeugen
            return new Response(
              JSON.stringify({ success: true, quotationId: existingQuotationId, documentType: 'quotations', reused: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          // Stale → altes Draft-Angebot in LexOffice loeschen (nur wenn noch open/draft)
          if (doc?.voucherStatus === 'draft' || doc?.voucherStatus === 'open') {
            try {
              await fetch(`https://api.lexoffice.io/v1/quotations/${existingQuotationId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${lexofficeApiKey}` },
              });
            } catch (delErr) {
              console.warn('[create-event-quotation] Could not delete stale quotation:', delErr);
            }
          }
          // Activity Log Eintrag fuer Audit
          try {
            const driftReasons: string[] = [];
            if (!totalsMatch) driftReasons.push('price');
            if (!remarkMatches) driftReasons.push('remark');
            if (!taxTypeMatches) driftReasons.push('tax_type');
            const driftReason = `${driftReasons.join('_and_')}_drift_detected`;
            await supabase.from('activity_logs').insert({
              entity_type: 'event_inquiry',
              entity_id: inquiryId,
              action: 'lexoffice_quotation_refreshed',
              new_value: {
                old_total: lexTotal,
                new_total: dbTotal,
                old_quotation_id: existingQuotationId,
                old_remark: lexRemark,
                new_remark: expectedRemark,
              },
              metadata: { reason: driftReason },
            });
          } catch { /* ignore */ }
          // Falls wir es nicht loeschen konnten oder Status finalized: id im Inquiry trotzdem zurueckziehen,
          // damit das neue gleich gesetzt wird (passiert weiter unten).
        }
      } catch (probeErr) {
        console.warn('[create-event-quotation] Freshness probe failed, will create new:', probeErr);
      }
    }

    // 3. Paketnamen für alle package_ids auflösen
    const packageIds = [...new Set(
      workingOptions.map((o: OfferOption) => o.package_id).filter(Boolean)
    )] as string[];

    const packageNameMap: Record<string, string> = {};
    if (packageIds.length > 0) {
      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, name')
        .in('id', packageIds);
      for (const p of pkgs || []) {
        packageNameMap[p.id] = p.name;
      }
    }

    // 4. Line-Items aus allen aktiven Optionen bauen.
    //    Bei mehreren Varianten ohne Kundenauswahl: erste Variante als parent,
    //    weitere als `subItems[].alternative=true` (Lex-API "OR"-Position).
    //    So wird die Summe der Quotation NICHT aufaddiert.
    //    WICHTIG: Pursue (Angebot → Rechnung) wird von Lex mit 406 abgelehnt,
    //    solange alternative/optional Items enthalten sind. Daher nur im
    //    reinen Angebots-Modus (kein forceDocumentType, keine Auswahl).
    const isInvoiceOrOrder = forceDocumentType === 'invoice' || forceDocumentType === 'order';
    const useAlternatives = !useSelectedQuantity && !isInvoiceOrOrder && workingOptions.length > 1;
    const lineItems: LexOfficeLineItem[] = [];
    if (useAlternatives) {
      const variants: LexOfficeLineItem[] = (workingOptions as OfferOption[]).map((opt) => {
        const pkgName = opt.package_id ? packageNameMap[opt.package_id] || null : null;
        return buildVariantLineItem(opt, pkgName);
      });
      const parent = variants[0];
      parent.subItems = variants.slice(1).map((v) => ({ ...v, alternative: true }));
      lineItems.push(parent);
    } else {
      for (const opt of workingOptions as Array<OfferOption & { selected_quantity?: number | null }>) {
        const pkgName = opt.package_id ? packageNameMap[opt.package_id] || null : null;
        const guestOverride = useSelectedQuantity ? (opt.selected_quantity ?? 0) : undefined;
        lineItems.push(...buildLineItems(opt, pkgName, guestOverride));
      }
    }

    if (lineItems.length === 0) {
      throw new Error('Keine Positionen für das Angebot — Menü oder Paket konfigurieren');
    }

    // ── Anzahlungsabzug (Schlussrechnung) ──────────────────────────────────
    // Pro vorausgegangener Anzahlungsrechnung eine eigene negative Brutto-
    // Zeile anhängen. Pflicht nach § 14 Abs. 5 UStG: Rechnungsnummer + Datum
    // im Namen, Bruttobetrag als negativer grossAmount, gleicher Steuersatz
    // wie die Anzahlung (Default 7 % Catering).
    if (Array.isArray(downPaymentDeductions) && downPaymentDeductions.length > 0) {
      for (const d of downPaymentDeductions as Array<{
        invoice_number?: string | null;
        date_iso?: string | null;
        gross: number;
        tax_rate?: number;
      }>) {
        const taxRate = typeof d.tax_rate === 'number' ? d.tax_rate : FOOD_TAX_RATE;
        const grossAbs = Math.abs(round2(d.gross || 0));
        if (grossAbs <= 0) continue;
        const dateDE = d.date_iso
          ? new Date(d.date_iso).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : '';
        const refLabel = d.invoice_number ? `Nr. ${d.invoice_number}` : '';
        lineItems.push({
          type: 'custom',
          name: `abzgl. Anzahlung gem. Rechnung${refLabel ? ` ${refLabel}` : ''}${dateDE ? ` vom ${dateDE}` : ''}`,
          description:
            'Bereits gezahlte Anzahlung (Netto, USt und Brutto) gemäß § 14 Abs. 5 UStG abgezogen.',
          quantity: 1,
          unitName: 'Pauschale',
          unitPrice: {
            currency: 'EUR',
            grossAmount: -grossAbs,
            taxRatePercentage: taxRate,
          },
        });
      }
    }

    // 5. Adressen live auflösen (kein Snapshot)
    const businessData = await loadBusinessData(supabase);
    const locationAddr = resolveLocationAddress(inquiry as never, businessData);
    const billingAddr = resolveBillingAddress(inquiry as never);
    const locationLine = formatLocationOneLine(locationAddr);

    if (!billingAddr.street || !billingAddr.postalCode || !billingAddr.city) {
      console.warn('[create-event-quotation] Empfänger-Adresse unvollständig — nur Name wird gesetzt', {
        inquiryId,
        billing: billingAddr,
      });
    }

    // 6. Einleitungstext aus erster aktiver Option (inkl. Veranstaltungsort)
    const firstOpt = workingOptions[0] as OfferOption;
    const introduction = buildIntroduction(
      inquiry as Record<string, unknown>,
      firstOpt.menu_selection,
      locationLine,
      {
        isInvoiceMode: forceDocumentType === 'invoice',
        isFinalInvoice: !!isFinalInvoice,
      },
    );

    // 6b. Zahlungs-Konditionen — pro Inquiry, Fallback auf site_settings.default_payment_terms
    const inq = inquiry as Record<string, unknown>;
    const isInvoiceMode = forceDocumentType === 'invoice';
    const paymentMethod = inq.payment_method as string | null;
    const invoiceDueDays = (inq.invoice_due_days as number | null) ?? 14;
    let depositPercent = inq.deposit_percent as number | null | undefined;
    const fixedDepositAmount = inq.deposit_amount as number | null | undefined;
    let depositDueDays = inq.deposit_due_days as number | null | undefined;
    let offerValidityDays = inq.offer_validity_days as number | null | undefined;

    if (depositPercent == null || depositDueDays == null || offerValidityDays == null) {
      const { data: settings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'default_payment_terms')
        .maybeSingle();
      const defaults = (settings?.value || {}) as { deposit_percent?: number; deposit_due_days?: number; offer_validity_days?: number };
      if (depositPercent == null) depositPercent = defaults.deposit_percent ?? 20;
      if (depositDueDays == null) depositDueDays = defaults.deposit_due_days ?? 5;
      if (offerValidityDays == null) offerValidityDays = defaults.offer_validity_days ?? 14;
    }

    // For invoice mode: Maestro-Zahlungskonditionen 1:1 abbilden.
    // Schlussrechnung (isFinalInvoice): Restzahlung nutzt balance_method
    // (z. B. Stripe-Link „balance_due_days_before_event“ Tage vor Event).
    // Reguläre Rechnung (kein Final): Zahlungsziel nach invoice_due_days.
    const balanceMethod = (inq.balance_method as string | null) || null;
    const balanceDueDaysBeforeEvent =
      (inq.balance_due_days_before_event as number | null) ?? null;
    const depositMethod = (inq.deposit_method as string | null) || null;

    const labelForMethod = (m: string | null): string => {
      switch (m) {
        case 'stripe':
        case 'stripe_now':
        case 'stripe_prepay': return 'per Stripe (Online-Zahlung)';
        case 'invoice':
        case 'invoice_before':
        case 'invoice_after': return 'per Überweisung';
        case 'onsite':
        case 'on_site':
        case 'cash':
        case 'card_onsite': return 'vor Ort (Bar / EC)';
        default: return '';
      }
    };

    const isOnSite = (m: string | null): boolean =>
      m === 'on_site' || m === 'onsite' || m === 'cash' || m === 'card_onsite';

    let paymentConditions: { paymentTermLabel: string; paymentTermDuration: number };
    let remarkText: string;

    if (isInvoiceMode && isFinalInvoice) {
      const bDays = Math.max(1, balanceDueDaysBeforeEvent ?? invoiceDueDays);
      const balanceOnSite = isOnSite(balanceMethod);
      const isInvoiceAfter = balanceMethod === 'invoice_after';
      const isInvoiceBefore = balanceMethod === 'invoice_before';
      const isStripeBalance = balanceMethod === 'stripe_prepay' || balanceMethod === 'stripe' || balanceMethod === 'stripe_now';

      const balanceLabel = balanceOnSite
        ? `Restzahlung vor Ort beim Event (Bar / EC)`
        : isInvoiceAfter
          ? `Restzahlung per Überweisung — Zahlungsziel ${daysLabel(invoiceDueDays)} nach Rechnungseingang`
          : isInvoiceBefore
            ? `Restzahlung per Überweisung — fällig ${daysLabel(bDays)} vor der Veranstaltung`
            : isStripeBalance
              ? `Restzahlung per Stripe (Online-Zahlung) — fällig ${daysLabel(bDays)} vor der Veranstaltung`
              : `Restzahlung fällig ${daysLabel(bDays)} vor der Veranstaltung`;

      paymentConditions = {
        paymentTermLabel: balanceLabel,
        paymentTermDuration: balanceOnSite ? 1 : (isInvoiceAfter ? invoiceDueDays : bDays),
      };

      const depositOnSite = isOnSite(depositMethod);
      const isStripeDeposit = depositMethod === 'stripe' || depositMethod === 'stripe_now';
      const isInvoiceDeposit = depositMethod === 'invoice' || depositMethod === 'invoice_before';

      const depAmountStr = (fixedDepositAmount && fixedDepositAmount > 0)
        ? `${fixedDepositAmount.toFixed(2)} €`
        : (depositPercent && depositPercent > 0 ? `${depositPercent}%` : null);

      const depSuffix = depositOnSite
        ? ' vor Ort'
        : isStripeDeposit
          ? ` per Stripe (Online-Zahlung) — innerhalb ${daysLabel(depositDueDays ?? 5)}`
          : isInvoiceDeposit
            ? ` per Überweisung — innerhalb ${daysLabel(depositDueDays ?? 5)}`
            : '';

      const depInfo = depAmountStr ? `Anzahlung ${depAmountStr}${depSuffix}` : null;
      const balancePhrase = balanceLabel.replace(/^Restzahlung /, '');
      remarkText = depInfo
        ? `${depInfo}, Restbetrag ${balancePhrase}. Vielen Dank für Ihre Buchung.`
        : `${balanceLabel}. Vielen Dank für Ihre Buchung.`;
    } else if (isInvoiceMode) {
      paymentConditions = {
        paymentTermLabel: `Zahlbar innerhalb von ${invoiceDueDays} Tagen nach Rechnungseingang`,
        paymentTermDuration: invoiceDueDays,
      };
      remarkText = `Vielen Dank für Ihre Buchung. Das Zahlungsziel beträgt ${invoiceDueDays} Tage nach Rechnungseingang.`;
    } else {
      paymentConditions = buildPaymentConditions(depositPercent, depositDueDays, fixedDepositAmount);
      const pair = legacyMethodPair(paymentMethod);
      const dMethodResolved = (depositMethod ?? pair.deposit) as DepositMethodKind;
      const bMethodResolved = (balanceMethod ?? pair.balance) as BalanceMethodKind;
      remarkText = buildOfferRemark({
        depositMethod: dMethodResolved,
        balanceMethod: bMethodResolved,
        depositPercent: depositPercent ?? 0,
        depositAmount: fixedDepositAmount ?? null,
        depositDueDays: depositDueDays ?? 5,
        balanceDueDaysBeforeEvent: balanceDueDaysBeforeEvent ?? 10,
        invoiceDueDays,
        offerValidityDays: offerValidityDays ?? 14,
      });
      // Avoid duplicate sentences in LexOffice PDF: the generic
      // "Anzahlung X% innerhalb von N Tagen" paymentTermLabel is replaced by
      // the detailed remarkText, and the remark itself is suppressed below.
      paymentConditions = {
        paymentTermLabel: remarkText,
        paymentTermDuration: paymentConditions.paymentTermDuration,
      };
    }

    // 7. LexOffice Dokument aufbauen — Empfänger aus resolved billing
    const addressBlock = {
      name: billingAddr.name || inquiry.contact_name,
      supplement: billingAddr.name && inquiry.contact_name && billingAddr.name !== inquiry.contact_name
        ? inquiry.contact_name
        : undefined,
      street: billingAddr.street || '',
      zip: billingAddr.postalCode || '',
      city: billingAddr.city || '',
      countryCode: billingAddr.countryCode,
    };

    const documentPayload: Record<string, unknown> = {
      voucherDate: new Date().toISOString(),
      address: addressBlock,
      lineItems: convertLineItemsToNet(lineItems),
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      paymentConditions,
      introduction,
    };
    // For quotations the remark would duplicate paymentTermLabel; only
    // include it for invoice modes where remarkText carries extra info.
    if (isInvoiceMode) {
      documentPayload.remark = remarkText;
    }
    else {
      // WICHTIG: LexOffice zieht sonst die organisationsweiten Standard-
      // Zahlungsbedingungen (z. B. "Anzahlung 50 % bis 3 Wochen vor der
      // Veranstaltung") in den remark-Block. Wir überschreiben das hier
      // explizit, damit auf dem Angebots-PDF nur unsere eigenen
      // Konditionen + der Schlusssatz erscheinen.
      documentPayload.remark =
        'Wir freuen uns auf Ihre Auftragserteilung und sichern eine einwandfreie Ausführung zu.';
    }

    if (isInvoiceMode) {
      // LexOffice invoices require shippingConditions
      const eventDate = inq.preferred_date as string | null;
      documentPayload.shippingConditions = {
        shippingType: 'service',
        shippingDate: eventDate
          ? new Date(eventDate + 'T12:00:00Z').toISOString()
          : new Date().toISOString(),
      };
    } else {
      // Quotations need expirationDate
      documentPayload.expirationDate = new Date(Date.now() + offerValidityDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const endpoint = isInvoiceMode ? 'invoices' : 'quotations';
    console.log(`Creating LexOffice ${endpoint}:`, JSON.stringify(documentPayload, null, 2));

    // 7. LexOffice API
    const response = await fetch(`https://api.lexoffice.io/v1/${endpoint}?finalize=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(documentPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LexOffice error:', errorText);
      throw new Error(`LexOffice API error: ${response.status} – ${errorText}`);
    }

    const result = await response.json();
    console.log(`LexOffice ${endpoint} created:`, result);

    // Document-ID an das Inquiry zurueckschreiben
    if (result?.id) {
      if (isFinalInvoice && isInvoiceMode) {
        // Schlussrechnung: in v2_events.final_lexoffice_invoice_* persistieren,
        // damit die reguläre invoice-Spalte (für die "normale" Rechnung) nicht
        // überschrieben wird. Direkt auf der Basistabelle schreiben, weil das
        // View event_inquiries diese Felder nicht durchreicht.
        const finalNumber = (result?.voucherNumber || result?.invoiceNumber || null) as string | null;
        await supabase
          .from('v2_events')
          .update({
            final_lexoffice_invoice_id: result.id,
            final_lexoffice_invoice_number: finalNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inquiryId);
      } else {
        const updateFields: Record<string, unknown> = {
          lexoffice_invoice_id: result.id,
        };
        if (!isInvoiceMode) {
          updateFields.lexoffice_quotation_id = result.id;
        }
        await supabase
          .from('event_inquiries')
          .update(updateFields)
          .eq('id', inquiryId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        quotationId: result.id,
        invoiceId: result.id,
        invoiceNumber: result?.voucherNumber || result?.invoiceNumber || null,
        documentType: endpoint,
        isFinalInvoice: !!isFinalInvoice,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
