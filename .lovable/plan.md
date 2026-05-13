## Problem 1 — LexOffice zeigt veralteten Betrag (CRITICAL)

### Was wir gefunden haben

Anfrage `90321866-…ce97`:
- **DB heute:** `total_amount` = 2 974,80 € (Hauptgang 35,00 € + Tiramisu 5,20 € × 74 = 40,20 € × 74)
- **LexOffice-Angebot AG0107:** ein Line Item, `grossAmount` = **35,00 €**, quantity 74 → **2 590,00 €**

→ Das LexOffice-Angebot wurde erstellt, **bevor** das Tiramisu (5,20 €) ins Paket aufgenommen wurde. Danach hat ein Maestro-User das Angebot bearbeitet → `inquiry_offer_options.total_amount` ging auf 2 974,80, aber die LexOffice-Quotation wurde **nie neu erzeugt**.

### Ursache im Code

`OfferSendPreview.tsx` (admin/refine/InquiryEditor):
```ts
if (!quotationId) {
  // create-event-quotation aufrufen
} else {
  // einfach die alte PDF runterladen
}
```
Sobald `event_inquiries.lexoffice_quotation_id` gesetzt ist, wird **nie** geprüft, ob das LexOffice-Dokument noch zum aktuellen Angebot passt. Versand zieht stale PDF.

Dasselbe Muster gilt auch für Rechnungen (`lexoffice_invoice_id` wird einmal gesetzt und nicht invalidiert wenn sich Beträge ändern).

### Fix — zweistufig, defensiv

**A) Beim Speichern jeder Angebotsänderung Belege invalidieren (Hauptfix)**

In allen Pfaden, die `inquiry_offer_options` oder beleg-relevante Inquiry-Felder mutieren:
- OfferBuilder Save (Wizard / WizardConfigurator / OfferEditor)
- `useCloneOfferVersion`
- repair-quotation-pricing
- jede Edge Function, die `total_amount`, `menu_selection`, `guest_count`, `equipment`, `staff`, `deposit_*`, `payment_method` ändert

→ Zusätzlich `event_inquiries.lexoffice_quotation_id = NULL` (und für Rechnungen analog: nur invalidieren solange `voucherStatus = 'draft'` / nicht bezahlt) setzen, sobald sich beleg-relevante Daten ändern.

Damit erzwingt jeder nächste „Vorschau / Senden" einen frischen Beleg auf Basis des aktuellen Standes. Bezahlte / finalisierte Belege werden **nicht** angefasst.

Optional (sauber): ein Hash über die beleg-relevanten Felder (`total_amount`, `menu_selection`, `guest_count`, `equipment`, `staff`, `deposit_amount`, `deposit_percent`, `payment_method`) in `event_inquiries.lexoffice_source_hash` schreiben. Beim Erstellen wird der Hash gespeichert; beim nächsten Preview wird verglichen — ungleich → neu erzeugen.

**B) Safety net im Preview/Sender (Backstop)**

`OfferSendPreview` und `create-event-quotation` (oder eine neue `ensure-fresh-quotation`):
1. Existiert `lexoffice_quotation_id`? Quotation per LexOffice-API laden, `totalGrossAmount` mit Summe aus `inquiry_offer_options.total_amount` (für aktive Optionen, ggf. × `selected_quantity`) vergleichen.
2. Bei Differenz > 0,01 €: alte Quotation `voucherStatus = 'draft'` → automatisch eine neue erzeugen, `lexoffice_quotation_id` ersetzen. Alte Draft-Quotation per `DELETE /quotations/{id}` aufräumen (best effort, Fehler ignorieren).
3. Im Activity Log einen Eintrag „LexOffice-Angebot wegen Preisdifferenz neu erzeugt (alt 2 590,00 € → neu 2 974,80 €)".

Damit ist auch der Bestand (Anfragen, deren Belege schon stale sind) automatisch geheilt, sobald jemand wieder „Vorschau" oder „Senden" anklickt.

**C) Bestehende Anfrage 90321866 reparieren**

Einmaliger Schritt direkt nach Deployment: für die Anfrage `lexoffice_quotation_id` auf NULL setzen, damit die nächste Preview die korrekten 2 974,80 € erzeugt. (Migration mit gezieltem UPDATE auf genau diese ID.)

### Akzeptanzkriterien

- Nach Bearbeiten eines Angebots zeigt Preview eine **neue** LexOffice-Quotation mit dem aktuellen Brutto-Total.
- Bezahlte Rechnungen werden nie überschrieben.
- Bei der Test-Anfrage steht im PDF: 2 974,80 € (Netto 2 780,19 € + 7 % USt 194,61 €).

---

## Problem 2 — Public Offer Galerie-Text

`src/pages/public-offer/RestaurantGallery.tsx`:
- Zeile 63: „Ein kurzer Eindruck von Räumen, Terrasse und Küche – tippen Sie auf ein Bild für die Großansicht."
  → Küche wird nicht gezeigt. Ändern auf: **„Ein kurzer Eindruck von unserem Haus und der Atmosphäre – tippen Sie auf ein Bild für die Großansicht."**
- Zeile 20: caption „Räume, Küche & Terrasse" → **„Räume & Atmosphäre"**
- Zeile 19: alt „… Show-Küche, Weinwand …" → **„… Innenraum, Weinwand und Außenansichten"** (kein „Show-Küche")

---

## Technische Details

**Betroffene Dateien**
- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` — Stale-Detection / Invalidierung beim Mount
- `supabase/functions/create-event-quotation/index.ts` — beim Aufruf alte Draft-Quotation in LexOffice löschen falls ersetzt
- alle Mutationsstellen für Angebots-Optionen (OfferBuilder Save, Clone, repair-quotation-pricing) — `lexoffice_quotation_id = NULL` setzen wenn beleg-relevante Felder geändert wurden
- `src/pages/public-offer/RestaurantGallery.tsx` — Texte
- Neue Migration: `lexoffice_quotation_id = NULL` für `90321866-…ce97`

**Nicht angefasst**
- Rechnungen mit `voucherStatus IN ('open','paid')` (LexOffice voucherStatus prüfen, bevor invalidieren).
- Layout/Design der Galerie und der Preview-Seite.

Soll ich so umsetzen?