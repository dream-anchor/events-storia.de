

# LexOffice-PDF in OfferSendPreview ergänzen — Vorschau funktionsfähig machen

## Befund

`OfferSendPreview` zeigt „Kein LexOffice-Angebot verknüpft", weil es das PDF **nur** anzeigen kann, wenn `event_inquiries.lexoffice_quotation_id` bereits gesetzt ist. Das passiert aber erst **nach** dem Klick auf „Senden" in `SmartInquiryEditor.handleSend` (Zeile 608–622: `create-event-quotation` → `update event_inquiries.lexoffice_quotation_id`).

Bei der Vorschau (`/admin/events/:id/preview?send=proposal`) ist die Quotation also bauartbedingt noch nicht vorhanden → Block 3 ist leer. Genau das zeigt der Screenshot.

Zusätzlich: Die `MultiOfferComposer.handleSendOffer` ruft `create-event-quotation` zwar auf, **wirft aber `quotationId` weg** und persistiert sie nicht. Das ist ein zweiter Bug, der dafür sorgt, dass die Quotation auch nach „Senden" über den neuen Wizard nicht in der Inquiry verlinkt wird → spätere Vorschauen bleiben ebenfalls leer.

## Lösung

### Fix 1 — Lazy-Quotation in `OfferSendPreview`

Wenn beim Mount `inquiry.lexoffice_quotation_id` fehlt, einmalig `create-event-quotation` aufrufen, die zurückgegebene `quotationId` in `event_inquiries.lexoffice_quotation_id` schreiben, lokalen State updaten und dann (wie bisher) `get-lexoffice-document` aufrufen. Dadurch sieht der Admin in der Vorschau **exakt das PDF**, das beim Senden angehängt würde.

Konkret im PDF-Loading-`useEffect` (Zeile 173–205):

1. `if (!inquiry.lexoffice_quotation_id)` → `await supabase.functions.invoke('create-event-quotation', { body: { inquiryId: inquiry.id } })`
2. Bei Erfolg: `setInquiry(prev => ({ ...prev!, lexoffice_quotation_id: data.quotationId }))` + DB-Update
3. Anschließend Standard-PDF-Fetch über `get-lexoffice-document`
4. Bei Fehler: aktueller Fehler-State (`pdfError`) + zusätzlicher Hinweis „Quotation konnte nicht erstellt werden" mit Retry-Button

Damit funktioniert die Vorschau **out-of-the-box**, ohne dass der Admin vorher etwas extra klicken muss. Beim späteren echten „Senden" prüft `SmartInquiryEditor.handleSend` ohnehin, ob bereits eine `lexoffice_quotation_id` vorhanden ist (falls nein, wird sie dort weiterhin erstellt — also keine Doppel-Quotation, sofern wir den Check dort noch ergänzen, siehe Fix 3).

### Fix 2 — `quotationId` im MultiOfferComposer persistieren

In `MultiOfferComposer.handleSendOffer` (Zeile 249–267): Antwort destrukturieren und persistieren — analog zu `SmartInquiryEditor`:

```ts
const { data: quotRes, error } = await supabase.functions.invoke("create-event-quotation", { ... });
if (error) throw error;
if (quotRes?.success && quotRes.quotationId) {
  await supabase.from('event_inquiries')
    .update({ lexoffice_quotation_id: quotRes.quotationId })
    .eq('id', inquiry.id);
}
```

### Fix 3 — Idempotenz-Guard in `SmartInquiryEditor.handleSend`

Vor dem `create-event-quotation`-Aufruf (Zeile 608) prüfen, ob `inquiry.lexoffice_quotation_id` bereits existiert (z.B. weil die Vorschau die Quotation schon angelegt hat). Wenn ja: Skip — dadurch werden keine Duplicate-Quotations in LexOffice angelegt.

```ts
if (sendType === 'proposal' && !inquiry.lexoffice_quotation_id) {
  // wie bisher: create-event-quotation aufrufen + persistieren
}
```

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` (~25 Zeilen: Lazy-Create im PDF-Effect + State-Update)
- `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` (~6 Zeilen: `quotationId` persistieren)
- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (1 Zeile: Idempotenz-Guard)

Keine Änderungen an Edge Functions, DB, RLS, Migrationen.

## Verifikation

1. Neue Inquiry → Wizard durchlaufen → „Vorschlag an Kunde senden" Vorschau-Button → Block 3 zeigt **das echte LexOffice-PDF** (statt der Leer-Meldung).
2. Inquiry hat danach `lexoffice_quotation_id` in DB gesetzt.
3. „Senden" klicken → kein neuer LexOffice-Beleg wird angelegt (Idempotenz), bestehende ID bleibt verknüpft.
4. Bei LexOffice-API-Fehler (z.B. fehlende Adresse): Vorschau zeigt klare Fehlermeldung + Retry-Button, Admin kann zurück zum Editor.

