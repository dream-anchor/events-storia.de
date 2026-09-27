// Shared bilingual content for outbound customer emails.
// Used by send-payment-email, send-payment-confirmation-v2,
// send-menu-confirmation, send-customer-response-copy and
// send-cancellation-notification.

import type { CustomerLang } from './customer-language.ts';

type Dict = Record<CustomerLang, string>;

export const LOCALE_MAP: Record<CustomerLang, string> = {
  de: 'de-DE',
  en: 'en-GB',
  it: 'it-IT',
  fr: 'fr-FR',
};

export function formatCurrency(lang: CustomerLang, cents: number): string {
  return new Intl.NumberFormat(LOCALE_MAP[lang], { style: 'currency', currency: 'EUR' })
    .format(cents / 100);
}

export function formatCurrencyEuro(lang: CustomerLang, euros: number): string {
  return new Intl.NumberFormat(LOCALE_MAP[lang], { style: 'currency', currency: 'EUR' })
    .format(euros);
}

export function formatDate(lang: CustomerLang, iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE_MAP[lang]);
}

export function formatDateLong(lang: CustomerLang, iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE_MAP[lang], {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function formatDateTime(lang: CustomerLang, iso: string): string {
  return new Date(iso).toLocaleString(LOCALE_MAP[lang], {
    dateStyle: 'long', timeStyle: 'short',
  });
}

export const STRINGS: Record<string, Dict> = {
  greeting: { de: 'Guten Tag', en: 'Hello', it: 'Buongiorno', fr: 'Bonjour' },
  signOff: { de: 'Herzliche Grüße,', en: 'Best regards,', it: 'Cordiali saluti,', fr: 'Cordialement,' },
  teamSignature: {
    de: 'Ihr STORIA Events Team',
    en: 'Your STORIA Events Team',
    it: 'Il vostro Team STORIA Events',
    fr: 'Votre équipe STORIA Events',
  },
  questionsLine: {
    de: 'Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung:',
    en: 'If you have any questions, we are happy to help:',
    it: 'In caso di domande, siamo a Vostra disposizione:',
    fr: 'Pour toute question, nous sommes à votre disposition :',
  },
  cancellationTermsTitle: {
    de: 'Stornobedingungen:',
    en: 'Cancellation terms:',
    it: 'Condizioni di disdetta:',
    fr: "Conditions d'annulation :",
  },
  cancellationTermsBody: {
    de: 'Bis 8 Wochen vor der Veranstaltung kostenfrei · zwischen der 8. und 4. Woche 35\u00a0% · danach 70\u00a0% des vereinbarten Speisenumsatzes (Preis pro Person × gebuchte Personen). Bereits bei Dritten beauftragte Leistungen, die nicht mehr kostenfrei stornierbar sind, werden berechnet. Anzahlungen verrechnen wir. Der Nachweis eines geringeren Schadens bleibt Ihnen unbenommen.',
    en: 'Free of charge up to 8 weeks before the event · between the 8th and 4th week 35\u00a0% · thereafter 70\u00a0% of the agreed food revenue (price per person × booked guests). Services already commissioned from third parties that can no longer be cancelled free of charge will be charged. Deposits are offset. You remain free to prove that the damage was lower.',
    it: "Gratuita fino a 8 settimane prima dell'evento · tra l'8ª e la 4ª settimana 35\u00a0% · successivamente 70\u00a0% del fatturato concordato per il cibo (prezzo a persona × persone prenotate). I servizi già commissionati a terzi che non possono più essere annullati gratuitamente vengono addebitati. Gli acconti vengono compensati. Resta salva la possibilità di dimostrare un danno minore.",
    fr: "Gratuit jusqu'à 8 semaines avant l'événement · entre la 8e et la 4e semaine 35\u00a0% · ensuite 70\u00a0% du chiffre d'affaires convenu pour les repas (prix par personne × personnes réservées). Les prestations déjà commandées auprès de tiers qui ne peuvent plus être annulées sans frais sont facturées. Les acomptes sont imputés. Vous restez libre de prouver un préjudice moindre.",
  },
  cancellationTermsFootnote: {
    de: 'Vollständige Bedingungen: AGB § 13 –',
    en: 'Full conditions: Terms and Conditions § 13 (German only) –',
    it: 'Condizioni complete: AGB § 13 (solo in tedesco) –',
    fr: 'Conditions complètes : CGV (AGB) § 13 (en allemand uniquement) –',
  },
  payNowCta: { de: 'Jetzt bezahlen →', en: 'Pay now →', it: 'Paga ora →', fr: 'Payer maintenant →' },
  paymentLinkValidity: {
    de: 'Sie können per Kreditkarte, SEPA-Lastschrift oder – bei Firmenbuchungen – auf Rechnung über Billie bezahlen. Der Zahlungslink ist 72 Stunden gültig.',
    en: 'You can pay by credit card, SEPA direct debit or – for company bookings – by invoice via Billie. The payment link is valid for 72 hours.',
    it: 'Potete pagare con carta di credito, addebito SEPA o – per le aziende – tramite fattura con Billie. Il link è valido per 72 ore.',
    fr: "Paiement par carte bancaire, prélèvement SEPA ou – pour les entreprises – sur facture via Billie. Le lien est valable 72 heures.",
  },
  legalDisclaimer: {
    de: 'Mit der Zahlung bestätigen Sie die Buchung zu den vereinbarten Konditionen. Es gelten unsere AGB (www.events-storia.de/agb). Da es sich um eine Leistung zu einem bestimmten Termin handelt, besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 9 BGB). Für Absagen gelten die Stornobedingungen gemäß AGB § 13.',
    en: 'By paying you confirm the booking under the agreed conditions. Our terms and conditions apply (www.events-storia.de/agb; only the German version is binding). As this is a service on a specific date, no right of withdrawal applies (§ 312g (2) no. 9 German Civil Code). Cancellations are governed by § 13 of our terms.',
    it: "Con il pagamento confermate la prenotazione alle condizioni concordate. Si applicano le nostre condizioni generali (www.events-storia.de/agb; fa fede solo la versione tedesca). Trattandosi di un servizio in una data specifica, non sussiste diritto di recesso (§ 312g comma 2 n. 9 BGB). Per le disdette vale il § 13 delle nostre condizioni generali.",
    fr: "Par votre paiement, vous confirmez la réservation aux conditions convenues. Nos CGV s'appliquent (www.events-storia.de/agb ; seule la version allemande fait foi). S'agissant d'une prestation à une date précise, aucun droit de rétractation ne s'applique (§ 312g al. 2 n° 9 BGB). Les annulations sont régies par le § 13 de nos CGV.",
  },
  privacyImprint: { de: 'Datenschutzerklärung', en: 'Privacy Policy', it: 'Informativa sulla privacy', fr: 'Politique de confidentialité' },
  imprint: { de: 'Impressum', en: 'Imprint', it: 'Note legali', fr: 'Mentions légales' },
  paymentTypeDeposit: { de: 'Anzahlung', en: 'Deposit', it: 'Acconto', fr: 'Acompte' },
  paymentTypePrepayment: { de: 'Vorauszahlung', en: 'Prepayment', it: 'Pagamento anticipato', fr: 'Paiement anticipé' },
  paymentTypeFinal: { de: 'Endabrechnung', en: 'Final payment', it: 'Saldo finale', fr: 'Solde final' },
  paymentTypeBalance: { de: 'Zahlung', en: 'Payment', it: 'Pagamento', fr: 'Paiement' },
};

export function t(lang: CustomerLang, key: keyof typeof STRINGS): string {
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.de ?? String(key);
}

export function paymentTypeLabel(lang: CustomerLang, type: string): string {
  if (type === 'deposit') return t(lang, 'paymentTypeDeposit');
  if (type === 'prepayment') return t(lang, 'paymentTypePrepayment');
  if (type === 'final') return t(lang, 'paymentTypeFinal');
  return t(lang, 'paymentTypeBalance');
}

export const SEPARATOR_HTML = `<div style="border-top:1px dashed #d9d2c5;margin:32px 0;"></div>`;
export const SEPARATOR_TEXT = `\n\n— — — — — — — — — — — — — — — — — — — —\n\n`;
