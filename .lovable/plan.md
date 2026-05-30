## Ziel

Im Inquiry-Editor einen Button **"Rechnung an Kunden senden"** ergänzen — sobald eine LexOffice-Rechnung existiert (Stripe-Webhook oder manuell). Klick öffnet einen **Vorschau-Dialog** mit PDF-Preview und E-Mail-Entwurf; Versand erst nach Bestätigung.

## UX-Flow

1. Header neben "Rechnung PDF" → neuer Button **"Rechnung senden"** (Mail-Icon, monochrom outline).
   - Sichtbar wenn `lexoffice_document_type === 'invoice'` und `lexoffice_invoice_id` vorhanden.
   - Badge "Bereits versendet am …" wenn `invoice_sent_at` gesetzt (sonst trotzdem erneut sendbar).
2. Klick → `SendInvoiceDialog` (max-w-4xl, scrollbar):
   - **Linke Spalte:** Empfänger (editierbar), Sprache (DE/EN/IT/FR — default = `customer_language`), Betreff (auto, editierbar), kurze Notiz/Zusatztext (optional, wird in den Body eingefügt).
   - **Rechte Spalte:** Live-Preview = Tabs `E-Mail` (HTML-Render in iframe via srcDoc) / `Rechnung PDF` (iframe der LexOffice-PDF, Blob via bestehendem `get-lexoffice-document`).
   - Footer: `Abbrechen` · `Senden an kunde@…` (primary).
3. Versand → Toast + Eintrag in Email-History + `invoice_sent_at` Timestamp.

## E-Mail-Inhalt

Bilingual nach bestehendem Standard (DE oben, Separator, EN unten; bei IT/FR primär + EN sekundär). Body:
- Anrede
- Kurzer Hinweis: "Anbei die Rechnung zu Ihrer Buchung [Order-Nr] vom [Datum]"
- Eventdetails-Kompaktblock (Datum, Gäste, Gesamtbetrag aus Maestro 1:1)
- Optionaler Zusatztext aus Dialog
- Signatur (dynamisch aus admin_identity, wie bei Angeboten)
- BCC: info@events-storia.de
- Attachment: LexOffice-Rechnungs-PDF

## Technische Umsetzung

**Neu:**
- `supabase/functions/send-invoice-email/index.ts` — orientiert sich an `send-payment-email`:
  - Input: `{ inquiry_id, recipient_email?, language?, extra_note? }`
  - Lädt LexOffice-PDF via interner Fetch zu `get-lexoffice-document` (mit `documentFileId`-Flow), base64-encoded als Resend-Attachment
  - Nutzt `_shared/customer-language.ts` + `_shared/email-i18n.ts` für bilingualen Body
  - Schreibt nach Versand: `event_inquiries.invoice_sent_at = now()` (neue Spalte, Migration unten) + Eintrag in `event_emails`-History
- `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx` — Dialog mit Vorschau (PDF iframe + HTML srcDoc), nutzt `supabase.functions.invoke('send-invoice-email')`. Preview-HTML wird clientseitig nach demselben Template gerendert (kleine helper-Funktion, Edge-Function ist Source of Truth für Versand).

**Geändert:**
- `SmartInquiryEditor.tsx` — Button neben `Rechnung PDF` (Zeile ~1009-1026), State für Dialog, Anzeige `invoice_sent_at`-Badge.

**Migration:**
```sql
ALTER TABLE public.v2_events
  ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_sent_by UUID;
```

## Scope-Grenzen

- Keine Änderung an LexOffice-Erstellung selbst (passiert weiterhin im Stripe-Webhook bzw. via "Manuelle Rechnung").
- Keine automatische Bilingual-Übersetzung des PDFs (LexOffice-Sprache bleibt wie erstellt — nur die E-Mail-Hülle ist bilingual).
- Kein Cron/Automatik — nur manueller Versand auf Klick.

## Dateien (Übersicht)

- **Neu:** `supabase/functions/send-invoice-email/index.ts`
- **Neu:** `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx`
- **Edit:** `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`
- **Migration:** `v2_events.invoice_sent_at` + `invoice_sent_by`

~3 Dateien + 1 Migration, ~350 LOC.