import type { GiftVariant } from "./types";

/** Verfügbare Menge einer Variante; unbegrenzt (available = null) = Infinity. Nur für Vergleiche, nie anzeigen. */
export const qtyLeft = (v: Pick<GiftVariant, "available">): number => (v.available === null ? Number.POSITIVE_INFINITY : v.available);

/** Knappheitshinweis nur bei fester, kleiner Menge (nie bei unbegrenztem Bestand). */
export const showFewLeft = (v: Pick<GiftVariant, "available">): boolean => v.available !== null && v.available > 0 && v.available <= 3;
