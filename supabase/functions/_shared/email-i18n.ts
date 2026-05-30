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
    de: 'Bis 30 Tage vorher: kostenlos · 14–30 Tage: 25\u00a0% · 7–14 Tage: 50\u00a0% · 2–7 Tage: 80\u00a0% · Unter 48\u00a0Std./No-Show: 100\u00a0% abzgl. ersparter Aufwendungen.',
    en: 'Up to 30 days before: free · 14–30 days: 25\u00a0% · 7–14 days: 50\u00a0% · 2–7 days: 80\u00a0% · Under 48\u00a0h / no-show: 100\u00a0% less saved expenses.',
    it: 'Fino a 30 giorni prima: gratuito · 14–30 giorni: 25\u00a0% · 7–14 giorni: 50\u00a0% · 2–7 giorni: 80\u00a0% · Sotto 48\u00a0ore / no-show: 100\u00a0% meno le spese risparmiate.',
    fr: "Jusqu'à 30 jours avant : gratuit · 14–30 jours : 25\u00a0% · 7–14 jours : 50\u00a0% · 2–7 jours : 80\u00a0% · Moins de 48\u00a0h / no-show : 100\u00a0% moins les frais économisés.",
  },
  cancellationTermsFootnote: {
    de: 'Vollständige AGB:',
    en: 'Full terms:',
    it: 'Condizioni complete:',
    fr: 'Conditions complètes :',
  },
  payNowCta: { de: 'Jetzt bezahlen →', en: 'Pay now →', it: 'Paga ora →', fr: 'Payer maintenant →' },
  paymentLinkValidity: {
    de: 'Sie können per Kreditkarte, SEPA-Lastschrift oder – bei Firmenbuchungen – auf Rechnung über Billie bezahlen. Der Zahlungslink ist 72 Stunden gültig.',
    en: 'You can pay by credit card, SEPA direct debit or – for company bookings – by invoice via Billie. The payment link is valid for 72 hours.',
    it: 'Potete pagare con carta di credito, addebito SEPA o – per le aziende – tramite fattura con Billie. Il link è valido per 72 ore.',
    fr: "Paiement par carte bancaire, prélèvement SEPA ou – pour les entreprises – sur facture via Billie. Le lien est valable 72 heures.",
  },
  legalDisclaimer: {
    de: 'Mit der Zahlung bestätigen Sie die Buchung zu den vereinbarten Konditionen. Es gelten unsere AGB für Veranstaltungen. Da es sich um eine Dienstleistung zu einem spezifischen Termin handelt, besteht kein Widerrufsrecht (§ 312g Abs. 2 Nr. 9 BGB). Es gelten die Stornobedingungen gemäß AGB.',
    en: 'By paying you confirm the booking under the agreed conditions. Our terms for events apply. As this is a service for a specific date, no right of withdrawal applies (§ 312g (2) no. 9 German Civil Code). Cancellation per our terms.',
    it: 'Con il pagamento confermate la prenotazione alle condizioni concordate. Si applicano i nostri Termini per gli eventi. Trattandosi di un servizio per una data specifica, non sussiste diritto di recesso (§ 312g comma 2 n. 9 BGB). Disdetta secondo i nostri Termini.',
    fr: "Par votre paiement, vous confirmez la réservation aux conditions convenues. Nos CGV événements s'appliquent. S'agissant d'une prestation à une date précise, aucun droit de rétractation ne s'applique (§ 312g al. 2 n° 9 BGB). Annulation selon nos CGV.",
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
