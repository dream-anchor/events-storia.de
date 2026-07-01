import type { CourseSelection, CourseType, EquipmentItem } from '../MenuComposer/types';
import type {
  FreeformProgram,
  FreeformProgramMeal,
  FreeformAdditionalService,
  MenuDay,
  OfferBuilderOption,
} from './types';

/**
 * Wandelt ein KI-geparstes FreeformProgram in die standardisierte
 * `menuSelection.days[]`-Struktur um — das Ergebnis sieht im Wizard
 * exakt aus wie ein handgemachtes Menü (nur mit Tages-Tabs darüber).
 *
 * Regeln:
 *  - Pro (Tag × Mahlzeit) → ein `MenuDay`. Label: „Mo 29.06. – Lunch".
 *  - Section-Items → CourseSelection mit `overridePrice`/`quantity`/`priceMode`.
 *    Preise werden 1:1 aus dem Text übernommen (Maestro-Prinzip).
 *  - Pauschale (`meal.flatPriceNet`) → eine „Pauschale"-Zeile (priceMode='flat'),
 *    falls keine Item-Preise bereits die Summe abdecken.
 *  - `meal.pricePerPersonNet` → eine „Preis pro Person"-Zeile, falls kein
 *    Item-Preis vorhanden ist.
 *  - `additionalServices` → `menuSelection.staff[]` (brutto = netto × (1+vat)).
 *  - `notes[]` + `scopeOfServices[]` → `tableNote` (join mit \n).
 */

function guessCourseType(heading?: string | null, meal?: string | null): CourseType {
  const t = `${heading ?? ''} ${meal ?? ''}`.toLowerCase();
  if (/dessert|dolce|nachspeise|s[üu]ß/.test(t)) return 'dessert';
  if (/pasta|risotto|primo/.test(t)) return 'pasta';
  if (/fisch|pesce/.test(t)) return 'main_fish';
  if (/fleisch|carne|kalb|rind|schwein|steak|lamm/.test(t)) return 'main_meat';
  if (/haupt|main|secondo/.test(t)) return 'main';
  if (/finger|snack|appetiz|canap/.test(t)) return 'fingerfood';
  if (/vegan/.test(t)) return 'vegan';
  if (/veget/.test(t)) return 'vegetarisch';
  if (/vorspeise|antipast|starter|empfang|carpaccio|aperitivo|apero/.test(t)) return 'starter';
  return 'starter';
}

function mealToCourses(meal: FreeformProgramMeal): CourseSelection[] {
  const out: CourseSelection[] = [];
  let itemsSumNet = 0;

  for (const section of meal.sections ?? []) {
    const heading = section.heading ?? null;
    const courseType = guessCourseType(heading, meal.label);
    const courseLabel = heading || meal.label || 'Speise';
    for (const item of section.items ?? []) {
      if (!item?.name) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Number.isFinite(item.unitPriceNet) ? item.unitPriceNet : 0;
      const priceMode: 'per_person' | 'flat' =
        item.priceMode === 'flat' ? 'flat' : 'per_person';
      out.push({
        courseType,
        courseLabel,
        itemId: null,
        itemName: item.name,
        itemDescription: null,
        itemSource: 'custom',
        isCustom: true,
        quantity: qty,
        overridePrice: price > 0 ? price : null,
        priceMode,
      });
      itemsSumNet += price * qty;
    }
  }

  // Pauschale nur ergänzen, wenn keine Item-Preise die Summe abdecken.
  const flat = Number(meal.flatPriceNet) || 0;
  if (flat > 0 && itemsSumNet <= 0) {
    out.push({
      courseType: guessCourseType(null, meal.label),
      courseLabel: meal.label || 'Pauschale',
      itemId: null,
      itemName: `Pauschale ${meal.label || ''}`.trim(),
      itemDescription: null,
      itemSource: 'custom',
      isCustom: true,
      quantity: 1,
      overridePrice: flat,
      priceMode: 'flat',
    });
  }

  // Preis pro Person ergänzen, falls kein Item-Preis vorhanden.
  const ppp = Number(meal.pricePerPersonNet) || 0;
  if (ppp > 0 && itemsSumNet <= 0 && flat <= 0) {
    const prefix = meal.pricePerPersonPrefix ? `${meal.pricePerPersonPrefix} ` : '';
    out.push({
      courseType: guessCourseType(null, meal.label),
      courseLabel: meal.label || 'Menü',
      itemId: null,
      itemName: `${prefix}${meal.label || 'Menü'}`.trim(),
      itemDescription: null,
      itemSource: 'custom',
      isCustom: true,
      quantity: 1,
      overridePrice: ppp,
      priceMode: 'per_person',
    });
  }

  return out;
}

function servicesToStaff(services: FreeformAdditionalService[] | null | undefined): EquipmentItem[] {
  if (!Array.isArray(services)) return [];
  return services
    .filter((s) => s?.label && Number(s.unitPriceNet) > 0)
    .map((s) => {
      const vat = Number(s.vatRate) || 0;
      const gross = Math.round(s.unitPriceNet * (1 + vat / 100) * 100) / 100;
      const qty = Math.max(1, Number(s.quantity) || 1);
      const unitSuffix =
        s.unit === 'hour' ? ' (pro Std.)' : s.unit === 'piece' ? ' (pro Stück)' : '';
      return {
        id: s.id || crypto.randomUUID(),
        name: `${s.label}${unitSuffix}`,
        pricePerUnit: gross,
        quantity: qty,
      };
    });
}

function buildTableNote(program: FreeformProgram): string | null {
  const parts: string[] = [];
  if (Array.isArray(program.scopeOfServices) && program.scopeOfServices.length > 0) {
    parts.push('LEISTUNGSUMFANG:\n' + program.scopeOfServices.map((s) => `• ${s}`).join('\n'));
  }
  if (Array.isArray(program.notes) && program.notes.length > 0) {
    parts.push('HINWEISE:\n' + program.notes.map((n) => `• ${n}`).join('\n'));
  }
  const joined = parts.join('\n\n').trim();
  return joined.length > 0 ? joined : null;
}

function formatDayLabel(dayDateLabel: string, mealLabel?: string): string {
  const d = (dayDateLabel || '').trim();
  const m = (mealLabel || '').trim();
  if (d && m) return `${d} – ${m}`;
  return d || m || '';
}

export interface FreeformToMenuResult {
  days: MenuDay[];
  staff: EquipmentItem[];
  tableNote: string | null;
  title: string;
}

export function freeformToMenuDays(program: FreeformProgram): FreeformToMenuResult {
  const days: MenuDay[] = [];
  for (const day of program.days ?? []) {
    const dayLabel = day.dateLabel ?? '';
    const meals = day.meals ?? [];
    if (meals.length === 0) {
      days.push({
        id: crypto.randomUUID(),
        dateLabel: dayLabel,
        isoDate: day.isoDate ?? null,
        mealLabel: null,
        guestCount: null,
        courses: [],
      });
      continue;
    }
    for (const meal of meals) {
      days.push({
        id: crypto.randomUUID(),
        dateLabel: formatDayLabel(dayLabel, meal.label),
        isoDate: day.isoDate ?? null,
        mealLabel: meal.label ?? null,
        guestCount: typeof meal.guestCount === 'number' && meal.guestCount > 0 ? meal.guestCount : null,
        courses: mealToCourses(meal),
      });
    }
  }
  return {
    days,
    staff: servicesToStaff(program.additionalServices ?? null),
    tableNote: buildTableNote(program),
    title: program.title || 'Catering-Programm',
  };
}

/**
 * Wendet ein FreeformProgram als Standard-Menü-State auf eine Option an —
 * schaltet `offerMode` auf 'menu' und befüllt `menuSelection.days[]`.
 */
export function applyFreeformAsMenu(
  option: OfferBuilderOption,
  program: FreeformProgram,
): Partial<OfferBuilderOption> {
  const mapped = freeformToMenuDays(program);
  const primaryGuests = mapped.days.find((d) => (d.guestCount ?? 0) > 0)?.guestCount ?? null;
  return {
    offerMode: 'menu',
    packageName: mapped.title,
    packageId: null,
    guestCount: primaryGuests ?? option.guestCount,
    menuSelection: {
      ...option.menuSelection,
      // freeformProgram bewusst entfernen — der Wizard ist jetzt die
      // einzige Quelle der Wahrheit.
      freeformProgram: null,
      courses: mapped.days.flatMap((d) => d.courses),
      days: mapped.days,
      staff: mapped.staff.length > 0 ? mapped.staff : option.menuSelection.staff,
    },
    tableNote: mapped.tableNote ?? option.tableNote,
    // totalAmount wird vom Recalc in useOfferBuilder automatisch neu berechnet.
  };
}