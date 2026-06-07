## Problem

Im Dialog „Rechnung an Kunden senden" zeigt der PDF-Tab nur den grauen Hinweis „Rechnungs-PDF konnte nicht geladen werden". Ursache laut Edge-Function-Logs:

```
LexOffice /document error 404
The requested resource with the id '5292ea1f-1157-4537-b4ed-e5671c328aa6' does not exist.
```

In `v2_events` ist `final_lexoffice_invoice_id` / `invoice_lexoffice_id` noch gesetzt, aber die Rechnung existiert in LexOffice nicht mehr (storniert/gelöscht). Der Dialog erkennt das nicht und behandelt die Rechnung als „vorhanden" — der Button „Endrechnung jetzt erzeugen" wird nie angezeigt, weil `invoiceExists=true`. Damit ist die Rechnung weder ansehbar noch versendbar und es gibt keinen Weg, eine neue Rechnung zu erzeugen.

## Fix (nur Frontend, ein File)

**Datei:** `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx`

1. **Fehler beim PDF-Laden tracken**
   - Neuer State `pdfError: string | null`.
   - Im PDF-Lade-`useEffect`: bei `error` oder fehlendem `pdf`-Feld setze `pdfError = "Diese Rechnung existiert nicht mehr in LexOffice (möglicherweise storniert). Bitte neu erzeugen."` und setze `pdfUrl = null`. Spezifisch auf 404/„not available"/„does not exist" reagieren.

2. **Recovery-UI im PDF-Tab**
   - Wenn `invoiceExists && !pdfLoading && !pdfUrl && pdfError`: gleiche Empty-State-Optik wie der „Noch keine Rechnung"-Zweig, aber mit Text aus `pdfError` und Button **„Endrechnung neu erzeugen"**.
   - Klick ruft denselben `handleCreateInvoice` auf, jedoch mit `body: { inquiryId, force: true }`, damit die idempotente Edge-Function `create-lexoffice-final-invoice` die alte ID überschreibt und eine frische LexOffice-Rechnung anlegt.
   - `handleCreateInvoice` bekommt dazu einen optionalen Parameter `force = false`.

3. **Send-Button absichern**
   - `canSend` zusätzlich `&& !pdfError` setzen, damit nicht aus Versehen eine nicht existierende Rechnung versendet wird (Versand würde sonst beim LexOffice-PDF-Abruf erneut 404 liefern).

4. **E-Mail-Vorschau-Fehler tolerieren**
   - Wenn `pdfError` gesetzt ist, E-Mail-Vorschau-Polling pausieren (`activeInvoiceId` reicht nicht aus, wenn LexOffice 404 liefert) — vermeidet unnötige Aufrufe und irreführende Fehler im E-Mail-Tab.

## Nicht im Scope
- Keine Änderungen an Edge Functions, DB, Migrationen, LexOffice-Logik.
- Keine Änderungen an `create-event-quotation`, `send-invoice-email`, `get-lexoffice-document-by-id`.
- Keine automatische DB-Bereinigung der stalen Invoice-ID — das Überschreiben passiert durch `create-lexoffice-final-invoice` mit `force: true`.
