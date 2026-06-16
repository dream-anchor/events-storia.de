/**
 * aiDraftToOption — Pure-Mapper für AI-Draft → OfferBuilder-Option.
 *
 * WICHTIG — Sicherheitsregeln:
 *  - Diese Datei darf NICHTS persistieren. Kein Supabase-Client, keine Edge-Function.
 *  - Preise aus dem AI-Draft werden NIE übernommen. Preise berechnet der OfferBuilder
 *    selbst aus den DB-Preisen × Gäste (siehe `pricingMode.ts` / `PriceBreakdown.tsx`).
 *  - Das Ergebnis ist ein In-Memory-Vorschlag (`isActive: false`).
 *  - `is_chosen`, `aiOrigin` werden NIE gesetzt/persistiert.
 *  - Custom Items und Open Questions landen NIE als Preisposition, sondern als
 *    Notizen/Warnings.
 *
 * Für Schritt 4.1 wird der Mapper noch nicht in die UI eingebunden. Der Konsument
 * (AiDraftCard / SmartInquiryEditor) folgt in Schritt 4.2.
 */

import type {
  OfferBuilderOption,
  OfferMode,
} from './types';
import type { CourseSelection } from '../MenuComposer/types';
import type { AiDraft } from '@/hooks/useAiDraft';

/** Schmale DB-Sicht eines Pakets — Caller liefert vorbereitete Liste. */
export interface DbPackageLite {
  id: string;
  name: string;
  /** Optional: wenn gesetzt, gilt das Paket als unverfügbar. */
  deleted_at?: string | null;
  archived_at?: string | null;
}

/** Schmale DB-Sicht eines Menü-Items — Caller liefert vorbereitete Liste. */
export interface DbMenuItemLite {
  id: string;
  name: string;
  /** Optional. Wird nicht aus dem Draft übernommen, sondern für späteren Recalc gehalten. */
  unit?: string | null;
  /** Optional: für Course-Type-Heuristik. */
  category_name?: string | null;
  deleted_at?: string | null;
  archived_at?: string | null;
}

export interface MapAiDraftCtx {
  /** Gästezahl aus der Inquiry — NICHT aus dem Draft übernehmen. */
  guestCount: number;
  /** Aktuell im OfferBuilder verwendete Labels (z. B. ['A','B']), für Anti-Kollision. */
  usedOptionLabels?: string[];
  /** DB-Pakete (idealerweise schon ohne deleted_at/archived_at, aber Mapper filtert defensiv noch einmal). */
  packages?: DbPackageLite[];
  /** DB-Menü-Items (analog). */
  menuItems?: DbMenuItemLite[];
}

export interface MapAiDraftResult {
  option: Partial<OfferBuilderOption> | null;
  warnings: string[];
  skippedItems: Array<{ name: string; reason: string }>;
  source: 'ai_draft';
}

const DEFAULT_UNIT = 'Stück';

function isAvailable(row: { deleted_at?: string | null; archived_at?: string | null } | undefined | null): boolean {
  if (!row) return false;
  if (row.deleted_at) return false;
  if (row.archived_at) return false;
  return true;
}

function nonEmpty(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t.length > 0 ? t : null;
}

function clampQty(q: number | null | undefined): number {
  if (q == null || !Number.isFinite(Number(q))) return 1;
  const n = Math.floor(Number(q));
  if (n < 1) return 1;
  if (n > 10_000) return 10_000;
  return n;
}

/**
 * Heuristik für CourseType. Konservativ: wir setzen "starter" als neutralen Default.
 * Der Betreiber kann den Course-Type im OfferBuilder anpassen.
 */
function courseTypeFromCategory(category?: string | null): CourseSelection['courseType'] {
  const c = (category ?? '').toLowerCase();
  if (/(dessert|nachspeise|dolce)/.test(c)) return 'dessert';
  if (/(pasta|primo)/.test(c)) return 'pasta';
  if (/(fisch|fish|pesce)/.test(c)) return 'main_fish';
  if (/(fleisch|meat|carne)/.test(c)) return 'main_meat';
  if (/(main|haupt|secondo)/.test(c)) return 'main';
  if (/(fingerfood|aperitivo|snack)/.test(c)) return 'fingerfood';
  if (/vegan/.test(c)) return 'vegan';
  if (/(veggie|vegetar)/.test(c)) return 'vegetarisch';
  return 'starter';
}

/**
 * Mappt einen AI-Draft auf eine vorbereitete OfferBuilder-Option (UI-State only).
 *
 * Test-Szenarien (manuell verifizierbar, siehe Bericht):
 *  1. Paket vorhanden            → option.offerMode='paket', packageId aus DB, kein Draft-Preis.
 *  2. Paket gelöscht/unbekannt   → option=null falls keine Items, sonst Items-Option; Warning.
 *  3. Menü-Item vorhanden        → CourseSelection mit DB-Name, ohne Draft-Preis.
 *  4. Item ohne unit             → DB-unit, sonst Fallback 'Stück' (nur als Note, da
 *                                  CourseSelection keine 'unit'-Property hat — siehe Notes).
 *  5. Item archiviert/gelöscht   → skippedItems + Warning, KEIN CourseSelection.
 *  6. Leerer Draft               → option=null, Warning.
 *  7. Custom Items               → tableNote, KEIN Preis-Item.
 *  8. Open Questions             → warnings, KEIN Preis-Item.
 */
export function mapAiDraftToOption(
  draft: AiDraft | null | undefined,
  ctx: MapAiDraftCtx,
): MapAiDraftResult {
  const warnings: string[] = [];
  const skippedItems: Array<{ name: string; reason: string }> = [];

  if (!draft || typeof draft !== 'object') {
    return {
      option: null,
      warnings: ['KI-Entwurf enthält keine übernehmbaren Pakete oder Speisen.'],
      skippedItems: [],
      source: 'ai_draft',
    };
  }

  const guestCount = Number.isFinite(ctx.guestCount) && ctx.guestCount > 0 ? ctx.guestCount : 1;
  const packagesDb = (ctx.packages ?? []).filter(isAvailable);
  const menuItemsDb = (ctx.menuItems ?? []).filter(isAvailable);

  // --- 1) Paket-Matching --------------------------------------------------
  const draftPackages = (draft.suggested_packages ?? []).filter(p => p && (nonEmpty(p.package_id) || nonEmpty(p.name)));
  let matchedPackage: DbPackageLite | null = null;

  if (draftPackages.length > 0) {
    const first = draftPackages[0];
    const byId = first.package_id ? packagesDb.find(p => p.id === first.package_id) : undefined;
    const byName = !byId && first.name
      ? packagesDb.find(p => p.name.trim().toLowerCase() === String(first.name).trim().toLowerCase())
      : undefined;
    matchedPackage = byId ?? byName ?? null;

    if (!matchedPackage) {
      warnings.push(
        `Paket „${nonEmpty(first.name) ?? 'unbekannt'}" nicht mehr im Katalog — bitte manuell prüfen.`,
      );
    }

    if (draftPackages.length > 1) {
      warnings.push(
        `KI hat ${draftPackages.length} Pakete vorgeschlagen — nur das erste wird übernommen.`,
      );
    }
  }

  // --- 2) Menü-Item-Matching ----------------------------------------------
  const draftItems = (draft.suggested_items ?? []).filter(i => i && (nonEmpty(i.menu_item_id) || nonEmpty(i.name)));
  const courses: CourseSelection[] = [];
  const itemNotes: string[] = [];

  for (const di of draftItems) {
    const byId = di.menu_item_id ? (ctx.menuItems ?? []).find(m => m.id === di.menu_item_id) : undefined;
    const byName = !byId && di.name
      ? menuItemsDb.find(m => m.name.trim().toLowerCase() === String(di.name).trim().toLowerCase())
      : undefined;
    const dbItem = byId ?? byName ?? null;

    if (!dbItem) {
      const label = nonEmpty(di.name) ?? 'unbekanntes Item';
      skippedItems.push({ name: label, reason: 'Item nicht mehr im Katalog — bitte ersetzen.' });
      itemNotes.push(`• ${label} (nicht im Katalog gefunden)`);
      continue;
    }

    if (!isAvailable(dbItem)) {
      const label = dbItem.name || nonEmpty(di.name) || 'archiviertes Item';
      skippedItems.push({ name: label, reason: 'Item archiviert/gelöscht — bitte ersetzen.' });
      itemNotes.push(`• ${label} (archiviert)`);
      continue;
    }

    const qty = clampQty(di.qty);
    const unit = nonEmpty(di.unit) ?? nonEmpty(dbItem.unit) ?? DEFAULT_UNIT;

    // WICHTIG: KI-Mengen sind nur Empfehlungen, keine harten Kalkulationsmengen.
    // Wir setzen quantity immer auf 1 und schreiben die KI-Empfehlung als Notiz.
    // So entstehen keine versteckten Multiplikatoren, wenn der Operator später
    // manuell einen Preis einträgt.
    if (qty > 1) {
      itemNotes.push(`• ${dbItem.name} — KI-Empfehlung: Menge ${qty} ${unit}`);
    }

    courses.push({
      courseType: courseTypeFromCategory(di.category ?? dbItem.category_name),
      courseLabel: nonEmpty(di.category) ?? nonEmpty(dbItem.category_name) ?? 'Gang',
      itemId: dbItem.id,
      itemName: dbItem.name, // bewusst aus DB, nicht aus Draft
      itemDescription: null,
      itemSource: 'catering',
      isCustom: false,
      // KEIN Preis aus Draft. OfferBuilder berechnet aus DB-Preis × Gäste.
      overridePrice: null,
      // KEINE KI-Menge als harte Kalkulationsmenge — siehe itemNotes oben.
      quantity: 1,
      priceMode: 'per_person',
      // 'unit' ist nicht Teil von CourseSelection — wir hängen sie an die Note,
      // damit der Betreiber sie beim Recalc berücksichtigen kann.
      ...(unit !== DEFAULT_UNIT || nonEmpty(di.unit) ? {} : {}),
    });
  }

  // --- 3) Custom Items + Open Questions als Notes -------------------------
  const customNotes = (draft.custom_items ?? [])
    .map(c => {
      const label = nonEmpty(c?.label);
      const note = nonEmpty(c?.note);
      if (!label && !note) return null;
      return label && note ? `• ${label} — ${note}` : `• ${label ?? note}`;
    })
    .filter((s): s is string => !!s);

  for (const q of (draft.open_questions ?? [])) {
    const t = nonEmpty(q);
    if (t) warnings.push(`Offene Frage: ${t}`);
  }

  const tableNoteParts: string[] = [];
  if (itemNotes.length > 0) {
    tableNoteParts.push('Hinweise zu Speisen (aus KI-Entwurf):', ...itemNotes);
  }
  if (customNotes.length > 0) {
    if (tableNoteParts.length) tableNoteParts.push('');
    tableNoteParts.push('Sonderwünsche (aus KI-Entwurf):', ...customNotes);
  }
  const tableNote = tableNoteParts.length > 0 ? tableNoteParts.join('\n') : undefined;

  // --- 4) Option zusammenstellen -----------------------------------------
  const hasPackage = !!matchedPackage;
  const hasCourses = courses.length > 0;

  if (!hasPackage && !hasCourses) {
    return {
      option: null,
      warnings: warnings.length > 0
        ? warnings
        : ['KI-Entwurf enthält keine übernehmbaren Pakete oder Speisen.'],
      skippedItems,
      source: 'ai_draft',
    };
  }

  const offerMode: OfferMode = hasPackage ? 'paket' : 'menu';

  const partial: Partial<OfferBuilderOption> = {
    packageId: matchedPackage?.id ?? null,
    packageName: matchedPackage?.name ?? '',
    offerMode,
    isActive: false, // niemals automatisch aktivieren
    guestCount,
    menuSelection: {
      courses,
      drinks: [],
    },
    // totalAmount bewusst nicht gesetzt — OfferBuilder berechnet neu.
    stripePaymentLinkId: null,
    stripePaymentLinkUrl: null,
    budgetPerPerson: null,
    discountPercent: 0,
    discountAmount: 0,
    pricingMode: 'per_person',
    ...(tableNote ? { tableNote } as Partial<OfferBuilderOption> : {}),
  };

  return {
    option: partial,
    warnings,
    skippedItems,
    source: 'ai_draft',
  };
}

// Re-Export der Public-Types für Konsumenten.
export type { OfferBuilderOption } from './types';
