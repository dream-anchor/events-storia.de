/**
 * Cost Acceptance (Kostenübernahme) — eSignatures.com Markdown template.
 *
 * Quelle/Inhaltliche Vorlage: KOSTENÜBERNAHME.pdf (Referenz, NICHT für Produktion).
 * Dieses Markdown ist die einzige autoritative Version des Vertragstexts.
 * Jede inhaltliche Änderung MUSS die TEMPLATE_VERSION erhöhen, damit
 * bestehende Kostenübernahmen weiterhin an ihren Originaltext gebunden bleiben.
 */

export const TEMPLATE_VERSION = "1.0.0";
export const REFERENCE_PDF_NAME = "KOSTENÜBERNAHME.pdf";

export const COST_ACCEPTANCE_TEMPLATE_TITLE =
  "Kostenübernahme — STORIA Catering & Events";

/**
 * Markdown mit Platzhaltern im Mustache-Stil ({{key}}).
 * eSignatures.com ersetzt die Platzhalter beim Erstellen des Contracts.
 * Signer-Felder werden zusätzlich über das Contract-Payload als
 * `signers[0].fields` eingebunden — Lovable/Render setzt sie hier als
 * Inline-Platzhalter, damit der finale Text im PDF erscheint.
 */
export const COST_ACCEPTANCE_TEMPLATE_MARKDOWN = `# KOSTENÜBERNAHME

**Speranza GmbH – Ristorante Pizzeria STORIA**
Karlstraße 47a · 80333 München
Telefon 089 51519696 · info@ristorantestoria.de · www.ristorantestoria.de
Amtsgericht München HRB 209637 · USt-IdNr. DE14318200980

---

## Bezugnahme auf das Angebot

| Angebotsnummer | Kundennummer | Angebotsdatum | Gültig bis |
|----------------|--------------|---------------|------------|
| {{offer_number}} | {{customer_number}} | {{offer_date}} | {{valid_until}} |

**Angebotssumme:** {{amount_gross}} {{currency}} brutto inkl. gesetzlicher MwSt.

Die vorliegende Kostenübernahme bezieht sich auf das oben genannte Angebot einschließlich aller darin aufgeführten Leistungen.

---

## Angaben zur Veranstaltung

- **Firma / Auftraggeber:** {{event_company}}
- **Veranstaltung / Anlass:** {{event_title}}
- **Veranstaltungsdatum:** {{event_date}}
- **Ansprechpartner vor Ort:** {{onsite_contact}}
- **Anzahl der Personen:** {{guest_count}}

---

## Verbindliche Kostenübernahme

Hiermit bestätigen wir, dass wir sämtliche Kosten übernehmen, die im Rahmen der oben genannten Veranstaltung entstehen.

Die Kostenübernahme umfasst die gemäß Angebot vereinbarten Leistungen. Grundlage der Abrechnung ist die vom oben genannten Ansprechpartner vor Ort bestätigte Gesamtrechnung.

**Zahlungsziel:** Der Rechnungsbetrag ist innerhalb von 5 Werktagen nach Rechnungserhalt ohne Abzug auf folgendes Konto zu überweisen.

**Kontoverbindung**
Kontoinhaber: Domenico Speranza
Bank: Deutsche Bank
IBAN: DE47 7007 0024 0095 6946 00

---

## Zusatzleistungen, Änderungen und Mehrverbrauch

Nicht im Angebot enthaltene Zusatzleistungen sowie nachträgliche Änderungen, Erweiterungen oder Mehrleistungen, die vom Auftraggeber oder dessen Vertretern vor Ort beauftragt werden, werden gesondert berechnet und zusätzlich in Rechnung gestellt.

Die tatsächlich in Anspruch genommenen Leistungen sowie vor Ort zusätzlich bestellte Speisen, Getränke oder Dienstleistungen werden gesondert berechnet und dem Auftraggeber in Rechnung gestellt.

{{additional_terms}}

---

## Rechnungsanschrift

- **Firma:** {{invoice_company}}
- **Straße / Hausnummer:** {{invoice_street}}
- **PLZ / Ort:** {{invoice_zip_city}}
- **Kostenstelle / Referenz (optional):** {{invoice_reference}}

---

## Bestätigung der Kostenübernahme

- **Unterzeichner:** {{signer_name}}
- **Firma:** {{signer_company_name}}
- **E-Mail:** {{signer_email}}
- **Mobil:** {{signer_mobile}}
- **Ort, Datum:** München, {{signature_date}}

Mit der digitalen Signatur dieses Dokuments bestätigt der Unterzeichner die verbindliche Kostenübernahme für das oben genannte Angebot.

---

Vielen Dank für Ihren Auftrag und das uns entgegengebrachte Vertrauen.

Wir freuen uns darauf, Ihre Veranstaltung erfolgreich auszurichten und stehen Ihnen für weitere Wünsche jederzeit gerne zur Verfügung.

_STORIA Catering & Events · Domenico Speranza_
`;

export interface CostAcceptancePlaceholders {
  offer_number: string;
  customer_number: string;
  offer_date: string;
  valid_until: string;
  amount_gross: string;
  currency: string;
  event_company: string;
  event_title: string;
  event_date: string;
  onsite_contact: string;
  guest_count: string;
  invoice_company: string;
  invoice_street: string;
  invoice_zip_city: string;
  invoice_reference: string;
  signer_name: string;
  signer_email: string;
  signer_mobile: string;
  signer_company_name: string;
  signature_date: string;
  additional_terms: string;
}

export function renderCostAcceptanceMarkdown(
  data: Partial<CostAcceptancePlaceholders>,
): string {
  return Object.entries(data).reduce((acc, [k, v]) => {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, "g");
    return acc.replace(re, (v ?? "—").toString());
  }, COST_ACCEPTANCE_TEMPLATE_MARKDOWN).replace(/{{[^}]+}}/g, "—");
}

/** Stable hash for template-version diffing. */
export async function templateContentHash(): Promise<string> {
  const enc = new TextEncoder().encode(COST_ACCEPTANCE_TEMPLATE_MARKDOWN);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** MFA-Regel basierend auf Betrag (€-Cents) und B2B/B2C-Flag. */
export function resolveMfaMethod(opts: {
  amountCents: number;
  isB2B: boolean;
}): "none" | "sms" | "photo_id" {
  const eur = opts.amountCents / 100;
  if (eur >= 10000) return "sms";
  if (!opts.isB2B) return "sms";
  if (opts.isB2B && eur >= 2500) return "sms";
  return "sms";
}