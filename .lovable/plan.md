## Ziel

Im Inquiry-Editor: Button heißt **„Rechnung schicken"** und ist nie ausgegraut (sofern Angebot angenommen). Klick öffnet immer die **Vorschau** zuerst — auch wenn noch keine LexOffice-Rechnung existiert. Im Dialog kann die Endrechnung dann mit einem Klick erzeugt werden, danach erscheinen PDF-Vorschau und Versand-Button.

## Änderungen

### 1. `SmartInquiryEditor.tsx` (Header-Button)

- Bedingung vereinfachen: Button erscheint sobald `isOfferSent` (oder besser: Angebot accepted) — **kein `hasInvoice`-Disabled-Zustand mehr**.
- Label immer **„Rechnung schicken"** (kein Wechsel auf „erneut senden"; stattdessen Tooltip mit letztem Versanddatum, falls vorhanden).
- `onClick` öffnet immer `setInvoiceDialogOpen(true)` — keine Vorbedingung mehr.

### 2. `SendInvoiceDialog.tsx` (Vorschau-Dialog)

- Neuer State: `invoiceExists` (aus aktueller `lexoffice_invoice_id` + `lexoffice_document_type === 'invoice'`).
- **Wenn keine Rechnung existiert:**
  - PDF-Tab zeigt Hinweis-Card: „Noch keine Rechnung in LexOffice vorhanden." + Button **„Endrechnung jetzt erzeugen"**.
  - Klick ruft Edge Function `create-lexoffice-final-invoice` mit `{ inquiry_id }` auf, zeigt Lade-Spinner, refetcht danach die `inquiry`-Row und lädt PDF via bestehendem `get-lexoffice-document`.
  - E-Mail-Tab funktioniert unverändert (Preview unabhängig vom PDF).
  - Footer-Button **„Senden an …"** bleibt disabled, solange keine Rechnung existiert. Tooltip erklärt: „Bitte zuerst Endrechnung erzeugen."
- **Wenn Rechnung existiert:** unverändertes Verhalten (PDF laden, Versand möglich).

### 3. Keine DB-/Migrations-Änderungen

- `invoice_email_sent_at` etc. bleiben wie sie sind.
- `create-lexoffice-final-invoice` existiert bereits — keine neue Edge Function nötig.

## Dateien

- **Edit:** `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (~10 Zeilen rund um Zeile 1034-1055)
- **Edit:** `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx` (Props erweitern um `invoiceExists` + `onInvoiceCreated`-Callback, neuer Inline-Erzeugen-Block im PDF-Tab + Disable-Logik im Footer)

~60 LOC, 2 Dateien, keine Migration.
