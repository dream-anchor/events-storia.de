import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

/**
 * Findet das beste MenuItem fuer einen Kurs — bevorzugt Items mit Preis > 0
 * und bei Gleichstand Ristorante vor Catering.
 *
 * Matching:
 *  1. Exakte ID-Match, falls itemId gegeben
 *  2. Name-basiert: exakte Gleichheit oder startsWith in beide Richtungen
 *     (faengt auch Faelle ab wo der itemName zusaetzliche Beschreibung enthaelt)
 *
 * Genutzt vom InlineCourseEditor (fuer Preis-Input-Placeholder) und
 * PriceBreakdown (fuer Zeilen-Berechnung).
 */
export function findBestMenuItem(
  items: CombinedMenuItem[] | undefined,
  itemId: string | null,
  itemName: string,
): CombinedMenuItem | undefined {
  if (!items?.length) return undefined;

  const candidates: CombinedMenuItem[] = [];

  if (itemId) {
    const exact = items.find((m) => m.id === itemId);
    if (exact) candidates.push(exact);
  }

  if (itemName) {
    for (const m of items) {
      if (candidates.includes(m)) continue;
      if (
        m.name === itemName ||
        itemName.startsWith(m.name) ||
        m.name.startsWith(itemName)
      ) {
        candidates.push(m);
      }
    }
  }

  if (candidates.length === 0) return undefined;

  return candidates.sort((a, b) => {
    const aHasPrice = (a.price && a.price > 0) ? 1 : 0;
    const bHasPrice = (b.price && b.price > 0) ? 1 : 0;
    if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice;
    if (a.source === 'ristorante' && b.source !== 'ristorante') return -1;
    if (b.source === 'ristorante' && a.source !== 'ristorante') return 1;
    return 0;
  })[0];
}
