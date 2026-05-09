/**
 * Operator-Email-Guard
 *
 * Verhindert, dass Angebote versehentlich an Betreiber-Adressen
 * (info@events-storia.de, info@ristorantestoria.de, ...) statt an
 * den Kunden geschickt werden. Mehrstufiger Schutz:
 *  - UI: blockt Versand & zeigt Bestätigungs-Dialog
 *  - Edge Function: lehnt Versand ohne `confirmedOperatorOverride` ab
 */

const OPERATOR_DOMAINS = [
  'events-storia.de',
  'www.events-storia.de',
  'ristorantestoria.de',
  'www.ristorantestoria.de',
  'storia-events.de',
  'www.storia-events.de',
];

const OPERATOR_LOCAL_PARTS = [
  'info',
  'kontakt',
  'office',
  'events',
  'catering',
  'noreply',
  'no-reply',
  'bestellung',
  'reservierung',
  'hello',
  'mail',
];

export interface OperatorCheckResult {
  isOperator: boolean;
  reason: string;
  matchedDomain?: string;
  matchedLocalPart?: string;
}

export function checkOperatorEmail(email: string | null | undefined): OperatorCheckResult {
  if (!email) return { isOperator: false, reason: '' };
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at < 0) return { isOperator: false, reason: '' };

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  const matchedDomain = OPERATOR_DOMAINS.find(
    (d) => domain === d || domain.endsWith('.' + d),
  );
  if (matchedDomain) {
    return {
      isOperator: true,
      reason: `Adresse gehört zur Betreiber-Domain ${matchedDomain}`,
      matchedDomain,
    };
  }

  const matchedLocal = OPERATOR_LOCAL_PARTS.find((lp) => local === lp);
  if (matchedLocal) {
    // Nur als Hinweis flaggen — Domain ist nicht Betreiber, aber generischer Postfach-Name
    return {
      isOperator: false,
      reason: '',
      matchedLocalPart: matchedLocal,
    };
  }

  return { isOperator: false, reason: '' };
}

/**
 * Synchroner Bestätigungs-Hook für Versand-Pfade.
 * Gibt true zurück wenn weiter gesendet werden darf.
 */
export function confirmOperatorRecipient(email: string): boolean {
  const msg =
    `⚠️ ACHTUNG — Empfänger ist eine Betreiber-Adresse:\n\n` +
    `   ${email}\n\n` +
    `Soll das Angebot wirklich an diese Adresse geschickt werden ` +
    `(statt an den Kunden)?\n\n` +
    `Klicke "Abbrechen", wenn das ein Versehen ist.`;
  return typeof window !== 'undefined' && window.confirm(msg);
}

/**
 * Kombi-Helper: prüft & fragt nach. Gibt true zurück wenn Versand fortfahren darf.
 */
export function guardRecipientEmail(email: string | null | undefined): boolean {
  const check = checkOperatorEmail(email);
  if (!check.isOperator) return true;
  return confirmOperatorRecipient(email!);
}