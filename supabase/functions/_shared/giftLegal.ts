/**
 * Geschenkkorb-Shop: Rechts-/Pflichttexte als Konstanten (DE/EN), von Mails (Edge) und Shop (Frontend) benutzt.
 *
 * ENTWURF: Der Wortlaut ist NICHT anwaltlich geprüft (Antoine klärt mit dem Anwalt, 20.11.2026, Punkt 9).
 * Vor Livegang prüfen lassen, dann hier an EINER Stelle anpassen; Entwurf des AGB-Teils: docs/ENTWURF-agb-geschenkkoerbe.md.
 */

/** Wird beim Bestellen gespeichert (gift_orders.agb_version). Beim Livegang auf die freigegebene AGB-Version setzen. */
export const GIFT_AGB_VERSION = "agb-2026-10+geschenkkoerbe-ENTWURF";

/**
 * Gate für den Livegang: solange false, zeigt die Bestellseite einen deutlichen internen Hinweis
 * "Rechtstexte nicht freigegeben". Erst auf true setzen, wenn AGB-Teil Geschenkkörbe, Widerruf und
 * Datenschutz-Ergänzung anwaltlich geprüft und live sind (Bauplan Einheit S5).
 */
export const GIFT_LEGAL_APPROVED = false;

export type Lang = "de" | "en";

export const GIFT_TEXTS = {
  withdrawal: {
    de: "Widerruf: Sie können Ihre Bestellung nur bis zur Abholung bzw. Übergabe des Geschenkkorbs widerrufen. Nach der Abholung bzw. Übergabe ist eine Rücknahme ausgeschlossen.",
    en: "Withdrawal: You may withdraw your order only until the gift basket has been collected or handed over. Once collected or handed over, returns are excluded.",
  },
  age: {
    de: "Wein und Crémant werden nur an Personen ab 16 Jahren abgegeben. Die Übergabe (Abholung und Lieferung) erfolgt nur an Personen ab 16 Jahren; bei Zweifeln bitten wir um einen Altersnachweis.",
    en: "Wine and crémant are only supplied to persons aged 16 or over. Handover (pickup and delivery) is made only to persons aged 16 or over; we may ask for proof of age.",
  },
  ageCheckbox: {
    de: "Ich bin mindestens 16 Jahre alt und nehme die Übergabe nur an Personen ab 16 Jahren zu.",
    en: "I am at least 16 years old and the handover will only be made to persons aged 16 or over.",
  },
  forecast: {
    de: "Voraussichtlicher Lieferpreis (einfache Strecke ab Karlstraße 47a). Der endgültige Preis wird bei der Bestellung berechnet.",
    en: "Estimated delivery price (single trip from Karlstraße 47a). The final price is calculated when you place the order.",
  },
  onSiteHint: {
    de: "Zahlung vor Ort: Wir reservieren Ihren Korb bis Ladenschluss des Abholtags. Wird er bis dahin nicht abgeholt, geht er automatisch zurück in den Verkauf.",
    en: "Pay on site: we reserve your basket until closing time on the pickup day. If it is not collected by then, it automatically returns to sale.",
  },
  lmivMissing: {
    de: "INTERN: Pflichtangaben (LMIV) für diesen Korb sind noch nicht vollständig erfasst – Shop darf so nicht live gehen.",
    en: "INTERNAL: mandatory food information (LMIV) for this basket is not complete yet – the shop must not go live like this.",
  },
} as const;
