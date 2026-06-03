## Zwei Fixes für die Belege-Karte

### 1. Schlussrechnung: "Event-Angebot" → "Event-Rechnung"

**Problem:** Die Schlussrechnung (RE0026) zeigt im PDF-Body `Event-Angebot für den 17.7.2026` — sollte `Event-Rechnung` bzw. `Event-Schlussrechnung` heißen.

**Ursache:** `create-lexoffice-final-invoice` ruft `create-event-quotation` mit `forceDocumentType=invoice` + `isFinalInvoice=true` auf. Die Funktion `buildIntroduction()` in `supabase/functions/create-event-quotation/index.ts` (Zeile 649–664) hardcodet aber immer `Event-Angebot für den …`.

**Fix:** `buildIntroduction()` bekommt zusätzliche Parameter `isInvoiceMode` und `isFinalInvoice` und wählt den Titel:
- `isFinalInvoice` → `Event-Schlussrechnung für den …`
- `isInvoiceMode` (Anzahlung/Standard) → `Event-Rechnung für den …`
- sonst → `Event-Angebot für den …`

Aufruf an Zeile 933 entsprechend anpassen. Englische Varianten bleiben unverändert (Lex-Texte sind ohnehin DE).

Zusätzlich denselben Fix in `supabase/functions/repair-quotation-pricing/index.ts` Zeile 359 nachziehen, damit eine Reparatur denselben Titel wieder herstellt.

Bestehende RE0026 wird dadurch NICHT rückwirkend repariert (LexOffice-Beleg ist finalisiert) — nur neue Schluss-/Anzahlungsrechnungen erhalten den korrekten Titel.

### 2. Versand-Historie pro Beleg anzeigen

**Ziel:** In der "Belege"-Karte und im Vorschau-Dialog soll bei jedem Beleg sichtbar sein, ob/wann/an wen er per Mail rausging.

**Datenquellen (bereits vorhanden):**
- **Angebot:** `email_delivery_logs` mit `entity_type='v2_event'`, `metadata->>'email_type'='offer_email'`, `metadata->>'lexoffice_quotation_id'` (matcht `doc.id`)
- **Rechnung (Anzahlung/Schluss):** `activity_logs` mit `entity_type='v2_event'`, `action='invoice_email_sent'`, `metadata->>'lexoffice_invoice_id'` (matcht `doc.id`); zusätzlich `recipient` und `resend_message_id`

**Umsetzung:**

1. **Edge Function `list-lexoffice-documents`** erweitern: pro Order zusätzlich alle relevanten Sende-Events laden (in zwei Queries: `email_delivery_logs` für quotations, `activity_logs` für invoices) und pro Dokument ein Feld `sends: { to: string; sent_at: string; message_id?: string }[]` anhängen (chronologisch, neueste zuerst).

2. **`OrderLexDoc`-Typ** in `src/hooks/useLexOfficeVouchers.ts` um `sends?: { to: string; sent_at: string; message_id?: string | null }[]` ergänzen.

3. **`LexofficeDocumentsCard.tsx`** — pro `<li>` unter der Zeile mit Datum/Betrag/Status eine dezente Zeile rendern:
   - keine Sends: kleiner muted Hinweis `Noch nicht versendet`
   - 1 Send: `Versendet am 03.06.26 14:22 an info.starke.jonathan@web.de`
   - >1 Sends: `Zuletzt versendet am … an …` + Badge `× N` mit Tooltip, der alle Sendungen listet

4. **`LexofficeDocumentPreviewDialog.tsx`** — im Header (rechts neben Nummer/Status) eine Mini-Pill `Versendet · 03.06.26` mit Hover-Tooltip (vollständige Liste) ergänzen. Bei "nicht versendet" eine outline-Pill `Nicht versendet`.

Keine DB-Migration nötig, keine Frontend-Routen-Änderung, kein neuer Endpoint — nur Edge-Function-Erweiterung + Render-Logik.

### Verifizierung
- Belege-Karte für AG0142 / RE0026 prüfen: Sendungen sichtbar inkl. Empfänger/Datum.
- Neue Schlussrechnung erzeugen (Testkontext) → PDF-Intro lautet `Event-Schlussrechnung für den …`.

### Geänderte Dateien
- `supabase/functions/create-event-quotation/index.ts` (buildIntroduction-Signatur + Aufruf)
- `supabase/functions/repair-quotation-pricing/index.ts` (analoger Text-Fix)
- `supabase/functions/list-lexoffice-documents/index.ts` (Sends pro Doc laden)
- `src/hooks/useLexOfficeVouchers.ts` (Typ)
- `src/components/admin/refine/InquiryEditor/LexofficeDocumentsCard.tsx`
- `src/components/admin/refine/InquiryEditor/LexofficeDocumentPreviewDialog.tsx`
