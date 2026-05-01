# Fix: Archiv-Ansicht, LexOffice-PDF-Vorschau, monochromer Download-Button

## 1. Archiv zeigt Original-Mail (1:1)

**Problem:** `useOfferHistoryVersion` sucht in `v2_event_emails` per Zeitfenster, findet aber nichts wegen UUID-Mismatch. `email_html` ist in der DB vorhanden, wird aber übergangen.

**Fix `src/hooks/useOfferHistory.ts`:**
- Den gesamten `v2_event_emails`-Lookup (Zeilen 82–110) entfernen.
- `email_html` direkt aus dem Query-Ergebnis verwenden — es kommt bereits aus `inquiry_offer_history`.
- `delivered_email_html` als Feld entfernen (nicht mehr nötig, war die Lookup-Quelle).

**Fix `src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx`:**
- Priorität vereinfachen: `email_html` → Plain-Text-Fallback.
- `delivered_email_html`-Referenz entfernen.
- Iframe-Höhe dynamisch per `onLoad` an `contentDocument.body.scrollHeight` anpassen.

## 2. LexOffice-PDF in Vorschau wieder auto-laden

**Fix `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx`:**
- Neuen `useEffect` hinzufügen, der `loadLexofficePdf()` automatisch aufruft, **nur wenn** `inquiry.lexoffice_quotation_id` bereits gesetzt ist.
- Kein Auto-Create — nur vorhandene PDFs werden geladen.

## 3. PDF-Download-Button monochrom restylen

**Fix `src/pages/PublicOffer.tsx` (`PdfDownloadSection`):**
- Container: `max-w-3xl`, weiße Card mit `border-neutral-200`, `rounded-2xl`, `bg-neutral-50`.
- Button: `border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50`, kein Schatten, kein Translate-Effekt.
- Touch-Target `min-h-[44px]` beibehalten.

## Sicherheit (Live-System)
- Keine DB-Migrationen, keine Edge-Function-Änderungen.
- Keine automatische LexOffice-Quotation-Erstellung.
- Reine UI- und Read-Path-Anpassungen.

## Geänderte Dateien
- `src/hooks/useOfferHistory.ts`
- `src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx`
- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx`
- `src/pages/PublicOffer.tsx`
