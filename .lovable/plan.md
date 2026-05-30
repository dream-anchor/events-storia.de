## Ziel

Bisher gilt der Modus **pro Person / pro Anlass** global für die gesamte Option. Künftig soll **jede einzelne Speise- und Getränkezeile** individuell auf "pro Person" oder "pauschal (pro Anlass)" gesetzt werden können — z.B. Hauptgang pro Person, aber "1 × Sektempfang" pauschal.

Der bestehende globale Toggle in `PriceBreakdown` bleibt als Default-Vorgabe für neue Zeilen erhalten, überschreibt aber nichts mehr.

## Datenmodell

Erweiterung der bestehenden Selection-Typen in `MenuComposer/types.ts` und `OfferBuilder/types.ts` (nur Frontend-Types — `menu_selection` ist `jsonb`, keine DB-Migration nötig):

- `CourseSelection.priceMode?: 'per_person' | 'flat'` (Default: `'per_person'`)
- `DrinkEinzelnItem.priceMode?: 'per_person' | 'flat'` (Default: `'per_person'`)
- `EquipmentItem` bleibt wie bisher pauschal (kein Toggle nötig).

Pauschale Pauschal-/Weinbegleitungs-Getränke (`drinksMode === 'pauschale' | 'weinbegleitung'`) bleiben unverändert pro Person, da sie konzeptuell so gedacht sind.

## UI

### 1. `InlineCourseEditor.tsx` (Speisen)
Pro Zeile zwischen Preis-Input und Trash-Button ein kompakter 2-Werte-Toggle (`/Pers.` ↔ `pauschal`), in derselben Optik wie der bestehende `PricingModeToggle`. Auf Mobile geht der Toggle in die Preis-Reihe (order-4).

Auswirkung im Editor:
- Zeilen-Total wird weiter aus `unitPrice × quantity` berechnet (Quantity-Feld bleibt für `per_event`-Modus erhalten).
- Suffix neben dem Preisfeld passt sich an: `€ / Pers.` vs. `€ pauschal`.

### 2. `DrinkSection.tsx` (Getränke, Modus "Positionen")
Identischer Toggle pro `drinksEinzeln`-Zeile. Suffix im Preis-Input wechselt zwischen `€ / Pers.` und `€` (pauschal).

### 3. `PriceBreakdown.tsx`
Berechnung in `dishLines` und Getränken anpassen:

- Wenn `priceMode === 'per_person'` → `lineTotal = unitPrice × quantity × guestCount`
- Wenn `priceMode === 'flat'` → `lineTotal = unitPrice × quantity`

`dishSubtotal` und `winePerPerson` werden auf einen einheitlichen **Gesamtbetrag** zusammengeführt. Der Toggle "Preis berechnen als pro Person / pro Anlass" über der Summe wird zur reinen **Anzeige-Sicht** der Zwischensumme (Gesamtbetrag vs. Gesamtbetrag ÷ Gäste), nicht mehr zur Eingabe-Interpretation.

Rabatt-Logik (Prozent auf Subtotal, €-Betrag auf Total) bleibt unverändert, basiert ab jetzt aber auf dem korrekt aggregierten Gesamtbetrag.

### 4. Public Offer (`pages/public-offer/types.ts`, `ProposalView.tsx`, `FinalOfferView.tsx`, PDF)
- `CourseSelection`/`DrinkSelection`-Types erhalten das optionale `priceMode`-Feld.
- Anzeige der Position: bei `flat` wird kein "/ Pers." Suffix gerendert, sondern der Betrag 1:1.
- `buildDrinkRows` berücksichtigt `priceMode` analog.

## Migration / Backwards Compatibility

- Alle Bestandsdaten haben `priceMode === undefined` → Behandlung als `'per_person'` (entspricht heutigem Verhalten in Verbindung mit dem globalen `pricingMode`).
- Beim **Laden** alter Optionen mit globalem `pricingMode === 'per_event'` werden alle Zeilen einmalig als `priceMode: 'flat'` migriert (in `useOfferBuilder` beim Initial-Load), damit das visuelle Ergebnis identisch bleibt.
- Der globale `pricingMode` bleibt als Default für neu hinzugefügte Zeilen erhalten — er beeinflusst aber keine Summen mehr.

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/MenuComposer/types.ts` — `CourseSelection.priceMode`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/types.ts` — `DrinkEinzelnItem.priceMode`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx` — Toggle pro Zeile + Suffix
- `src/components/admin/refine/InquiryEditor/OfferBuilder/DrinkSection.tsx` — Toggle pro Zeile + Suffix
- `src/components/admin/refine/InquiryEditor/OfferBuilder/PriceBreakdown.tsx` — Aggregations-Logik per Zeile
- `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts` — Migration alter Daten beim Initial-Load
- `src/pages/public-offer/types.ts` — Type-Erweiterung + `buildDrinkRows`
- `src/pages/public-offer/ProposalView.tsx` / `FinalOfferView.tsx` — Suffix-Rendering

Keine DB-Migration, keine Edge-Function-Änderung.

## Out of Scope

- LexOffice-Rechnungspositionen (laufen weiterhin als Brutto-Totals 1:1 aus Maestro — `priceMode` wird beim Mapping zur Rechnung nur zur Suffix-Anzeige genutzt, nicht für die Summe).
- E-Mail-Templates: zeigen nur den Totalbetrag, kein Per-Line-Suffix nötig.
