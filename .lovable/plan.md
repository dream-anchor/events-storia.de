## Ziel

Anzahlungen UStG-konform abbilden: jede Anzahlung erzeugt eine **Anzahlungsrechnung** in LexOffice (mit fortlaufender Nummer, separat ausgewiesener USt, Bezug zum Veranstaltungsdatum). Nach dem Event wird eine **Schlussrechnung** erstellt, die alle vorausgegangenen Anzahlungen mit Rechnungsnummer, Datum, Netto-, USt- und Bruttobetrag explizit abzieht (§ 14 Abs. 5 UStG).

## Ist-Zustand (kurz)

- `event_payments` hat bereits `payment_type ∈ {deposit, prepayment, final}` und `lexoffice_invoice_id` je Zahlung, aber es wird **keine** LexOffice-Rechnung pro Anzahlung erzeugt.
- `handle-stripe-webhook → handleEventOfferPayment` setzt nur `paid_amount` / `remaining_amount` auf der Inquiry.
- `create-lexoffice-invoice` und `create-event-quotation` kennen nur `quotation` / `invoice` — kein Anzahlungs- oder Schlussrechnungsmodus, kein Anzahlungsabzug.
- Manuelle Zahlungen (`AddPaymentDrawer`) werden nur intern verbucht.
- **Hinweis zur LexOffice-API:** Der `/down-payment-invoices`-Endpoint ist read-only. Anzahlungs- und Schlussrechnungen werden also als normale `invoices` mit klarem Titel/Block angelegt — das ist UStG-konform und entspricht exakt der vom Auftraggeber zitierten Beispielzeile.

## Sollverhalten

### 1. Anzahlungsrechnung — automatisch bei Zahlungseingang
Sobald eine `event_payments`-Zeile mit `payment_type ∈ {deposit, prepayment}` bezahlt wird (Stripe-Webhook **oder** manuelle Erfassung über `AddPaymentDrawer`):
- LexOffice-Rechnung erzeugen mit
  - Titel: "Anzahlungsrechnung" (bzw. "2. Anzahlungsrechnung" bei weiteren Anzahlungen)
  - Introduction enthält Leistungszeitraum / Veranstaltungsdatum / Event-Bezeichnung
  - Line-Items = der gezahlte Anzahlungsbetrag, USt separat ausgewiesen (gleicher Steuersatz wie die zugrunde liegende Leistung, i. d. R. 7 % für Speisen-Catering, 19 % für Service/Logistik; pauschal: gemischte Aufschlüsselung wie auf der späteren Schlussrechnung — Default: einheitlich Anteil 7/19 entsprechend dem prozentualen Mix des Auftrags)
  - `taxConditions: { taxType: 'gross' }` (Brutto-Preise gemäß Memory `lexoffice-gross-pricing`)
  - `paymentConditions.paymentTermLabel = "Bereits bezahlt am DD.MM.YYYY"`
- `event_payments.lexoffice_invoice_id` + `lexoffice_invoice_number` persistieren.
- PDF an Kunde mailen + BCC `info@events-storia.de` (bestehender `sendInvoicePdfByEmail`-Flow).
- Aktivität loggen: "Anzahlungsrechnung Nr. X über Y € erstellt".

### 2. Schlussrechnung — beim Schritt "Schlussrechnung erstellen"
Trigger: Admin klickt im Inquiry-Editor auf neue Aktion "Schlussrechnung erstellen" (oder automatisch beim Bezahlen einer `final`-Zahlung).
- Vollständige Leistung als Line-Items wie heute.
- Anschließend pro vorausgegangener Anzahlung eine **eigene Abzugs-Line-Item** mit negativem Betrag:
  - Name: `abzgl. Anzahlung gem. Rechnung Nr. {invoice_number} vom {DD.MM.YYYY}`
  - Brutto = `-payment.amount_cents/100`, USt-Satz = gewichteter Satz der Anzahlungsrechnung
  - Sicherstellt, dass Netto, USt und Brutto in der Summe korrekt zusammenpassen.
- Titel: "Schlussrechnung"
- Verbindet via `event_payments.lexoffice_invoice_id` alle Anzahlungen mit der Schlussrechnung (neues Feld: `final_invoice_id` auf der Inquiry oder Referenz via `event_payments.notes`).

### 3. Reservierungspauschalen (Ausnahme)
Optionales Flag `payment.is_reservation_fee` (nur per Hand setzbar). Wenn `true` → keine UStG-Anzahlungsrechnung, sondern interne Verbuchung „Terminblockierung". Aus Scope für Phase 1 ausgelagert, nur Schema-Hook vorbereiten.

## Änderungen

### Migrationen
- `ALTER TABLE event_payments ADD COLUMN is_reservation_fee boolean DEFAULT false NOT NULL` (für späteren Ausnahmefall, schon vorbereiten).
- `ALTER TABLE event_inquiries ADD COLUMN final_lexoffice_invoice_id text` + `final_lexoffice_invoice_number text` (Schlussrechnung getrennt vom Angebots-`lexoffice_invoice_id`).

### Edge Functions
- **Neu: `supabase/functions/create-lexoffice-downpayment-invoice/index.ts`**
  - Input: `{ payment_id }` (aus `event_payments`).
  - Lädt Payment + Inquiry, baut LexOffice-Invoice (Brutto, Titel "Anzahlungsrechnung"), persistiert `lexoffice_invoice_id` + `lexoffice_invoice_number` zurück.
  - Validiert: Idempotenz (skip, wenn `lexoffice_invoice_id` schon existiert), Payment ist bezahlt, kein `is_reservation_fee`.
  - Mailt PDF an Kunde (analog `sendInvoicePdfByEmail`).

- **Neu: `supabase/functions/create-lexoffice-final-invoice/index.ts`**
  - Input: `{ inquiry_id }`.
  - Lädt Inquiry + Items + alle `event_payments` mit `lexoffice_invoice_id`.
  - Baut Schlussrechnung mit (a) regulären Line-Items, (b) Abzugs-Line-Items pro Anzahlung.
  - Persistiert `final_lexoffice_invoice_id` + `final_lexoffice_invoice_number` auf `event_inquiries`.
  - Idempotent.

- **Update `handle-stripe-webhook` → `handleMaestroPayment` und `handleEventOfferPayment`:**
  - Nach erfolgreicher Zahlung von `payment_type ∈ {deposit, prepayment}`: `create-lexoffice-downpayment-invoice` aufrufen.
  - Nach erfolgreicher Zahlung von `payment_type = 'final'`: `create-lexoffice-final-invoice` aufrufen.

- **Update `AddPaymentDrawer`-Flow:**
  - Wenn manuelle Zahlung mit Status `paid` markiert wird → gleiche Edge-Function-Aufrufe wie oben.
  - Neue „Schlussrechnung erstellen"-Action im `PaymentCard`, ruft `create-lexoffice-final-invoice` direkt auf (für Fälle ohne `final`-Stripe-Zahlung, z. B. komplette Anzahlung am Anfang + Rest in bar).

### UI
- `PaymentCard.tsx`: pro `event_payments`-Zeile Link/Button „Anzahlungsrechnung öffnen" (PDF-Download via bestehendes `get-lexoffice-document`).
- Neuer Button „Schlussrechnung erstellen" im Inquiry-Editor (sichtbar, sobald mind. eine bezahlte Anzahlung existiert und das Event-Datum vorbei ist oder Status `completed`).
- Inquiry-Sidebar zeigt Liste aller LexOffice-Belege: Anzahlungsrechnungen + Schlussrechnung (analog bestehender Voucher-Liste, siehe Memory `lexoffice-document-visibility`).

### Memory-Update
- Neue Memory-Datei `mem://integrations/lexoffice-downpayment-flow` mit den oben definierten Regeln, plus Ergänzung in `mem://business/offer-lifecycle-management` zu „Anzahlung erzeugt sofort Anzahlungsrechnung".

## Out-of-Scope (Phase 2)
- Reservierungspauschalen-Sonderlogik außer Schema-Flag.
- Stornierung/Korrektur von Anzahlungsrechnungen (LexOffice-Storno-Beleg) — bleibt vorerst manuell.
- Migration historischer Anzahlungen ohne Rechnung — eigener Backfill-Job nach Approval.

## Verifikation
1. Test-Inquiry mit 30 % Anzahlung anlegen → Stripe-Zahlung simulieren → Anzahlungsrechnung in LexOffice + PDF-Mail.
2. Zweite Anzahlung manuell verbuchen → zweite Anzahlungsrechnung mit fortlaufender Nummer.
3. „Schlussrechnung erstellen" → Schlussrechnung mit zwei Abzugszeilen, Summen stimmen auf den Cent.
4. Idempotenz: zweiter Aufruf erzeugt keine Duplikate.
5. Reservierungspauschalen-Flag = true → keine LexOffice-Erstellung, nur interne Verbuchung.