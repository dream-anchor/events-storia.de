## Ziel

1. Buttons **„Anfrage absagen"** und **„Angebot annehmen"** im Inquiry-Editor ersatzlos entfernen (samt zugehörigem Dialog/Drawer).
2. Button **„Rechnung schicken"** ist **jederzeit** verfügbar (unabhängig vom Status), öffnet **immer zuerst die Vorschau** (E-Mail + PDF). Versand erst nach expliziter Freigabe im Dialog.

## Änderungen

### `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`

**Entfernen:**
- Import `CancellationDialog` (Zeile 38)
- Import `OfferAcceptanceDrawer` (Zeile 40)
- State `showCancelDialog`, `showAcceptanceDrawer` (Zeile 109–110)
- Handler `handleCancelInquiry` (Zeile 168 ff., falls nirgendwo sonst genutzt)
- Button-Block „Anfrage absagen" (Zeilen 1124–1134)
- Button-Block „Angebot annehmen" (Zeilen 1135–1148)
- `<CancellationDialog ... />` und `<OfferAcceptanceDrawer ... />` (Zeilen 1163–1184)
- Nicht mehr verwendete Icon-Imports (`Ban`, `CheckCircle2`) prüfen

**Anpassen — „Rechnung schicken"-Button:**
- Sichtbarkeitsbedingung von `isOfferSent` lösen → **immer sichtbar**, sobald ein Empfänger (`inquiry.email`) existiert.
- Niemals disabled. Tooltip zeigt letztes Versanddatum, falls vorhanden, sonst „Vorschau öffnen".
- `onClick` öffnet immer den `SendInvoiceDialog`.

### `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx`

Bereits umgesetztes Verhalten bleibt:
- Dialog öffnet mit E-Mail-Vorschau + PDF-Vorschau-Tab.
- Wenn keine LexOffice-Rechnung existiert → Hinweis-Card + Button **„Endrechnung jetzt erzeugen"** (ruft `create-lexoffice-final-invoice`).
- Footer-Button **„Senden an …"** disabled, bis Rechnung existiert.
- Versand erst nach Klick auf „Senden" — das ist die Freigabe.

Keine weiteren Änderungen am Dialog nötig.

### Datei-Cleanup

- **Löschen:** `src/components/admin/refine/InquiryEditor/OfferAcceptanceDrawer.tsx` (nur hier importiert).
- `CancellationDialog` bleibt erhalten (wird ggf. an anderer Stelle verwendet) — nur Import hier entfernen.

### Keine DB-/Migration-Änderungen

Status-Updates (`status = 'confirmed'` / `'declined'`) bleiben weiterhin durch Public-Offer-Flow, Stripe-Webhooks und Rechnungserstellung möglich.

## Dateien

- **Edit:** `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`
- **Delete:** `src/components/admin/refine/InquiryEditor/OfferAcceptanceDrawer.tsx`

~80 LOC weg, 0 LOC dazu (Dialog ist fertig).
