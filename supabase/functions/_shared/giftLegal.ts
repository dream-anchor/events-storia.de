/**
 * Geschenkkorb-Shop: Rechts-/Pflichttexte als Konstanten (DE/EN), von Mails (Edge) und Shop (Frontend) benutzt.
 *
 * ENTWURF: Der Wortlaut ist NICHT anwaltlich geprüft (Antoine klärt mit dem Anwalt, 20.11.2026, Punkt 9).
 * Vor Livegang prüfen lassen, dann hier an EINER Stelle anpassen; Entwurf des AGB-Teils: docs/ENTWURF-agb-geschenkkoerbe.md.
 */

/** Wird beim Bestellen gespeichert (gift_orders.agb_version). Beim Livegang auf die freigegebene AGB-Version setzen. */
export const GIFT_AGB_VERSION = "AGB-2026-11";

/**
 * Livegang-Gate (Freigabe der Rechtstexte): EINE Quelle, die Server-Env `GIFT_LEGAL_APPROVED=true`
 * (create-gift-order lehnt echte Bestellungen sonst ab). Das Frontend liest den Status über die Edge Function
 * `gift-shop-config`, nicht aus einer Konstante hier.
 */

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
    de: "Ich bin mindestens 16 Jahre alt und bestätige, dass die Übergabe nur an Personen ab 16 Jahren erfolgt.",
    en: "I confirm that I am at least 16 years old and that the handover will only be made to persons aged 16 or over.",
  },
  forecast: {
    de: "Voraussichtlicher Lieferpreis (einfache Strecke ab Karlstraße 47a). Der endgültige Preis wird bei der Bestellung berechnet.",
    en: "Estimated delivery price (single trip from Karlstraße 47a). The final price is calculated when you place the order.",
  },
  onSiteHint: {
    de: "Zahlung vor Ort: Sie erhalten eine E-Mail mit einem Bestätigungslink; erst nach dem Klick ist Ihr Korb reserviert, und zwar bis Ladenschluss des Abholtags. Wird er bis dahin nicht abgeholt, geht er automatisch zurück in den Verkauf.",
    en: "Pay on site: you will receive an email with a confirmation link; your basket is reserved only after you click it, until closing time on the pickup day. If it is not collected by then, it automatically returns to sale.",
  },
  /** Hinweis zu den Lebensmittelangaben (Inhaber 20.11.2026: Schätzungen reichen vorerst, ehrlich gekennzeichnet). */
  lmivNotice: {
    de: "Angaben nach bestem Wissen; maßgeblich ist das Etikett. Fragen zu Allergenen beantworten wir gern unter",
    en: "Information to the best of our knowledge; the label is authoritative. We are happy to answer questions about allergens at",
  },
  /** Bestätigungsmail "vor Ort zahlen" (Double-Opt-in): bewusst ohne frei wählbaren Text des Absenders. */
  optinIntro: {
    de: "für Ihren Wunsch, einen STORIA Geschenkkorb zu reservieren, benötigen wir noch Ihre Bestätigung. Erst nach Klick auf den Link ist der Korb für Sie reserviert.",
    en: "to reserve a STORIA gift basket for you we still need your confirmation. The basket is reserved for you only after you click the link.",
  },
  optinHint: {
    de: "Der Link ist 30 Minuten gültig. Haben Sie keine Reservierung angefragt, ignorieren Sie diese Mail einfach; es entsteht nichts.",
    en: "The link is valid for 30 minutes. If you did not request a reservation, simply ignore this email; nothing will be created.",
  },
} as const;
