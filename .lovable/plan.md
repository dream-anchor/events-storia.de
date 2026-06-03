## Ziel
Pro Auftrag alle in LexOffice angelegten Belege (Angebot, Anzahlungsrechnungen, Schlussrechnung, Stornos) sauber auflisten, einsehen, herunterladen und bei Bedarf direkt aus Maestro stornieren. Verhindert Duplikat-Erstellung und macht den Audit-Trail nachvollziehbar.

## Teil 1 — Daten-Bereinigung (a14872bb-…)

Status: 1 Quotation (`583d668d`) + 1 Schlussrechnung (`8b082049`). Aktuell hält `v2_events.invoice_lexoffice_id` fälschlich die Quotation-ID. Migration setzt:
- `invoice_lexoffice_id = NULL`
- `lexoffice_document_type = NULL`

(nur für diese Zeile; Quotation bleibt in `lexoffice_quotation_id` erhalten).

## Teil 2 — Neue Edge Function `list-lexoffice-documents`

Input: `{ orderId }`
Logik:
1. `v2_events` lesen → `final_lexoffice_invoice_id`, `invoice_lexoffice_id`, `lexoffice_quotation_id`, `booking_number`
2. `v2_payments` für `event_id` → alle Zeilen mit `lexoffice_invoice_id`
3. Pro gefundener ID parallel `/v1/invoices/{id}` bzw. `/v1/quotations/{id}` von LexOffice holen → `voucherNumber`, `voucherDate`, `totalPrice.totalGrossAmount`, `voucherStatus` (`open`/`paid`/`voided`)
4. Klassifikation `kind`:
   - `final` → `final_lexoffice_invoice_id`
   - `deposit` → IDs aus `v2_payments` (mit `payment_type='deposit'|'prepayment'`)
   - `standard` → `invoice_lexoffice_id` (falls ≠ final & ≠ quotation)
   - `quotation` → `lexoffice_quotation_id`
5. Sortierung: nach `voucherDate` aufsteigend, Quotation zuletzt
6. Output: `[{ id, type, kind, number, date, gross, status }]`

## Teil 3 — UI: Beleg-Center im Inquiry-Editor

Neue Komponente `LexofficeDocumentsCard` (im rechten Bereich neben/unter `PaymentCard`, monochrom, rounded-2xl):

```text
Belege
─────────────────────────────────────────────
Angebot           AN-2025-0099   10.04.   2.250,00 €   offen      [Ansehen] [Download]
Anzahlung         RE-2025-0123   20.04.     500,00 €   bezahlt    [Ansehen] [Download]
Schlussrechnung   RE-2025-0231   18.06.   1.250,00 €   offen      [Ansehen] [Download] [Stornieren]
```

- Bei `status='voided'` → Zeile mit `line-through` + Badge „Storniert"
- „Stornieren" nur bei `invoice` und Status ≠ `voided`/`paid`
- Bei Klick auf „Ansehen" → bestehender `get-lexoffice-document`-Flow mit `voucherId + voucherType`
- Lädt via React-Query (`useQuery(['lex-docs', orderId])`), refetch nach Storno

## Teil 4 — Edge Function `void-lexoffice-invoice`

Input: `{ orderId, voucherId }`
1. Auth-Check (admin role)
2. LexOffice: `POST /v1/invoices/{id}/voucherstatus` mit `{ voucherStatus: 'voided' }` (LexOffice unterstützt direktes Voiding nur bei nicht-finalisierten; ansonsten **Gutschrift** erforderlich)
3. Wenn Voiding direkt nicht möglich → automatisch `POST /v1/credit-notes` als Gegenbeleg erzeugen mit gleicher Position/Betrag, Referenz zur stornierten Rechnung
4. Maestro-DB: passende `lexoffice_*_id`-Spalte je nach Quelle (v2_events oder v2_payments) auf `NULL` setzen, damit „neue Rechnung erstellen" wieder freigegeben wird
5. `activity_logs`-Eintrag (`action='invoice_voided'`, mit altem/neuem Voucher und User)

Sicherheitsbestätigung im UI: Modal „Rechnung stornieren? Erstellt eine Gutschrift in LexOffice. Nicht umkehrbar."

## Teil 5 — Idempotenz-Härtung

- `SmartInquiryEditor` deaktiviert „Schlussrechnung erstellen" wenn `final_lexoffice_invoice_id IS NOT NULL` (bereits umgesetzt)
- `create-lexoffice-deposit-invoice` (falls vorhanden) prüft je `v2_payments.id`, ob `lexoffice_invoice_id` schon gesetzt; wenn ja → skip + return existing
- `create-lexoffice-final-invoice`: bleibt idempotent (bereits umgesetzt)

## Teil 6 — Technische Details (für später)

**LexOffice Voucher-Status-API**
- Endpoint: `PUT /v1/invoices/{id}` mit `voucherStatus`
- Finalisierte Rechnungen können nicht direkt voided werden → `POST /v1/credit-notes` (mit `precedingSalesVoucherId`)
- Retry-Logik wie in `get-lexoffice-document` (`fetchWithRetry`, MAX_RETRIES=3)

**Mapping kind ↔ DB-Spalte (für Voiding-Cleanup)**
| kind        | DB-Update                                                       |
|-------------|------------------------------------------------------------------|
| final       | `v2_events.final_lexoffice_invoice_id = NULL`                   |
| standard    | `v2_events.invoice_lexoffice_id = NULL`                          |
| deposit     | `v2_payments.lexoffice_invoice_id = NULL` (per voucherId match) |
| quotation   | `v2_events.lexoffice_quotation_id = NULL`                        |

**Realtime**: `LexofficeDocumentsCard` invalidiert bei Realtime-Update auf `v2_events` oder `v2_payments` für den `orderId`.

**Files**
- Neu: `supabase/functions/list-lexoffice-documents/index.ts`
- Neu: `supabase/functions/void-lexoffice-invoice/index.ts`
- Neu: `src/components/admin/refine/InquiryEditor/LexofficeDocumentsCard.tsx`
- Edit: `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (Card einhängen)
- Edit: `src/hooks/useLexOfficeVouchers.ts` (Hooks `useLexofficeDocuments`, `useVoidLexofficeInvoice`)
- Migration: Bereinigung für `a14872bb-…`

## Validierung
1. Beleg-Center zeigt für `a14872bb-…` exakt 2 Zeilen (Angebot + Schlussrechnung)
2. Download/Vorschau funktioniert für beide
3. Test-Storno einer Test-Rechnung erzeugt Gutschrift in LexOffice und gibt UI frei
4. Kein automatischer Neu-Versuch der Schlussrechnung erzeugt Duplikat
