## Ziel
1. **Pizza-Duplikate beseitigen** (Option B): redundante Pizzen aus dem Catering-Datenbestand entfernen, damit sie nur noch aus der Ristorante-Quelle stammen.
2. **Rechnungs-PDF-Vorschau** im "Rechnung an Kunden senden"-Dialog für Event-Anfragen reparieren — aktuell schlägt der Lade-Aufruf still fehl, weil die Edge Function `get-lexoffice-document` Event-Anfragen nicht kennt und das Frontend zusätzlich einen falschen Response-Key liest.

---

## Teil 1 — Pizza Option B (DB-Bereinigung)

Soft-Delete via `archived_at = now()` (kein Hard-Delete; die `purge_deleted_menu_items()`-Cron räumt sonst nach 60 Tagen für `deleted_at` — `archived_at` bleibt persistent als historisches Stilllegen).

**Migration:**
```
UPDATE menu_items
   SET archived_at = now()
 WHERE category_id IN (
   'cccc3333-3333-3333-3333-333333333331',  -- Pizza Pane
   'cccc3333-3333-3333-3333-333333333332'   -- Pizze Classiche
 )
   AND archived_at IS NULL;

UPDATE menu_categories
   SET archived_at = now(),
       is_active = false
 WHERE id IN (
   'cccc3333-3333-3333-3333-333333333331',
   'cccc3333-3333-3333-3333-333333333332'
 );
```

Effekt: `useCombinedMenuItems` filtert `archived_at IS NULL` bereits → die 25 Pizzen verschwinden aus dem Catering-Stream; Suche/Tabs zeigen Pizzen nur noch mit Source-Badge "Restaurant". Reversibel durch `archived_at = NULL` falls jemals wieder gebraucht.

---

## Teil 2 — Rechnungs-PDF-Vorschau (zwei Bugs)

### Bug 2a — Edge Function `get-lexoffice-document` kennt Anfragen nicht
Im "Order Mode" wird ausschließlich aus `catering_orders` gelesen:
```ts
.from('catering_orders').select('… lexoffice_invoice_id …').eq('id', orderId)
```
Für eine Event-Anfrage (z.B. `a14872bb-…`) gibt es dort keinen Treffer → 404 → Frontend zeigt "Rechnungs-PDF konnte nicht geladen werden".

**Fix:** Wenn der Lookup in `catering_orders` leer ist, Fallback auf `event_inquiries` (gleiche Spalten `lexoffice_invoice_id`, `lexoffice_document_type`; Order-Number aus `booking_number` / via `v2_events`). Reihenfolge: zuerst `catering_orders`, dann `event_inquiries`, dann 404.

### Bug 2b — Falscher Response-Key im Dialog
`SendInvoiceDialog.tsx` (Zeile 86–90) prüft `"pdf_base64" in data`, die Edge Function antwortet aber mit `{ pdf, documentType, filename }`. Selbst wenn die Function liefert, würde der Branch nie greifen.

**Fix:** Frontend liest `data.pdf` und behandelt das als Base64-PDF (oder die Edge Function liefert zusätzlich `pdf_base64` als Alias). Sauberer Weg: Frontend an Function-Contract anpassen (`data.pdf`).

### Geänderte Dateien
- `supabase/functions/get-lexoffice-document/index.ts` — Order-Lookup um `event_inquiries`-Fallback erweitern.
- `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx` — Response-Parsing auf `data.pdf` umstellen (Blob-Branch bleibt).

---

## Validierung
1. Anfrage `a14872bb-1e40-4fc5-9869-5a6864651062` öffnen → "Rechnung schicken" → PDF-Tab muss die LexOffice-Rechnung anzeigen.
2. CateringModules-Picker → Suche "Pizza" → jede Pizza erscheint **einmal** mit Badge "Restaurant", keine Catering-Variante mehr.
3. Edge-Function-Logs (`get-lexoffice-document`) zeigen erfolgreichen 2-Step-Flow; kein 404.

Kein UI-Redesign, keine weiteren Workflows betroffen.
