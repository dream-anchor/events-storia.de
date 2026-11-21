// Mischwarenkorb (Catering + Geschenkkörbe, Konzept § 11): Anzeige-Hilfen. Keine React-Abhängigkeit.
// Körbe werden immer BRUTTO angezeigt (kein Netto-Umschalter); maßgeblich sind die Serverpreise (create-gift-order).

/** Betrag wie PriceDisplayContext.formatPrice: auf den Cent abgeschnitten, deutsches Format (Float-Rauschen vorher auf 1/100 Cent gerundet). */
export const formatEuroTruncated = (value: number): string =>
  `${(Math.trunc(Math.round(value * 10000) / 100) / 100).toFixed(2).replace(".", ",")} €`;

/** Gesamtsumme der Anzeige: Catering-Anteil (je nach Brutto/Netto-Schalter) + Korb-Anteil (immer brutto). */
export const formatMixedTotal = (cateringDisplayValue: number, giftGross: number): string =>
  formatEuroTruncated(cateringDisplayValue + giftGross);

/** Korb-Anteil des Warenkorbs (Anzeige): Gesamtsumme minus Catering-Anteil, auf Cent gerundet (Float-Rauschen). */
export const giftSubtotalOf = (totalPrice: number, cateringSubtotal: number): number =>
  Math.round((totalPrice - cateringSubtotal) * 100) / 100;
