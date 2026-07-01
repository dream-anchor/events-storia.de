## Ziel

Zwei Korrekturen im „Neue Anfrage"-Flow:

1. **Keine KI-Paketvorschläge mehr in Schritt 2.** Die Karte „KI-Vorschläge" (Business Dinner Exclusive / Network Aperitivo mit „Hinzufügen"-Buttons) verschwindet komplett — inklusive der erkannten Item-Chips.
2. **Das im Freitext erkannte Menü landet zuverlässig als Option A im Wizard** — genau so, als hätte man den Text im „Freitext-Import" eingegeben. Aktuell bleibt Option A leer und zeigt die Typ-Auswahl-Kacheln.

## Änderungen

### 1. `src/components/admin/refine/OfferCreate/index.tsx`

- `AISuggestionsCard`-Import und -Verwendung in `Step2KontaktEvent` entfernen. Props `suggestions` und `suggestedItems` aus `Step2Props` streichen, im Parent nicht mehr durchreichen.
- State `suggestions` / `suggestedItems` und deren Setter komplett entfernen (werden nirgends sonst gebraucht).
- Extraktion weiter laufen lassen (`parse-inquiry-text` liefert weiterhin Kontakt/Datum/Gästezahl), nur die Suggestions-Felder werden verworfen.
- Der grüne „Menü-Programm erkannt"-Badge (`freeformDetected`) bleibt — kleine Info reicht.
- `isNonTrivialFreeformProgram` lockern: `true`, wenn eines zutrifft:
  - ≥1 Day mit Meal-Items ODER `flatPriceNet>0` ODER `pricePerPersonNet>0` (heutige Logik), **oder**
  - ≥1 Day mit gesetztem `mealLabel` / `guestCount`, **oder**
  - `program.additionalServices.length > 0`, **oder**
  - `program.scopeOfServices.length > 0` / `program.notes.length > 0`.
  
  Rationale: Ein knapper Text („3 Abendessengänge, 3 Gläser Wein, Aperitif, 90 € p.P.") liefert vom Parser oft nur strukturierte Tages-Skelette + Notes ohne einzelne Items — soll trotzdem als KI-Preview in den Wizard.
- Zusätzlich: Wenn `parse-freeform-offer` weder Fehler noch ein non-trivial-Programm liefert, den **Rohtext** unter `sessionStorage['pending_freeform_text:<inquiryId>']` ablegen. Das ermöglicht dem Editor einen einmaligen Retry serverseitig, falls die erste Parse-Runde zu leer war.

### 2. `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts`

- Beim initialen Load-Zweig „keine Options in DB": Wenn kein `pending_freeform_program` da ist, aber `pending_freeform_text` vorhanden ist, **einmal** `parse-freeform-offer` erneut aufrufen (best effort, im `try/catch`). Ergebnis wird wie das direkt übergebene Programm behandelt (Option A mit `offerMode='menu'`, `aiOrigin=true`, Auto-Save via `isDirtyRef=true` / `dirtySourceRef='ai_import'`).
- SessionStorage-Keys werden nach Konsum entfernt (bereits vorhanden für `_program`; für `_text` analog).
- Kein Fallback-Loop: schlägt der Retry fehl / bleibt leer, wird Option A wie heute im Modus `unselected` angezeigt.

### 3. Aufräumen

- `AISuggestionsCard.tsx` bleibt vorerst im Repo (nicht löschen), damit kein toter Import zurückbleibt — nur nicht mehr verwendet. Falls du löschen willst: sag Bescheid, dann streiche ich sie inkl. `SuggestedPackage`/`SuggestedItem`-Typen.

## Kosten & Risiken

- Zweite `parse-freeform-offer`-Runde im Editor nur wenn Intake-Runde leer war → typischerweise 1 Extra-AI-Call pro Anfrage im Worst Case, ansonsten 0.
- Keine Änderungen an DB-Schema, Auth, RLS, Public-Offer oder Send-Flow.
- Kein Auto-Send, kein Auto-Persist der KI-Preview außerhalb des bestehenden Auto-Save-Pfads.

## Testfall (der aus deinem Screenshot)

Text mit „Firmendinner … 19 Personen … 90 € p.P. … 3 Abendessengänge, 3 Gläser Wein, Aperitif":
- Schritt 2 zeigt **nur** Kontakt + Event-Details + kleinen „KI-Entwurf bereit"-Badge (keine Paket-Kacheln mehr).
- Nach „Zur Angebotskonfiguration": Option A ist im `menu`-Modus, Tages-Tabs sichtbar, „Aperitif / Vorspeise / Hauptgang / Dessert / Weinbegleitung" als bearbeitbare Zeilen mit Preisen aus dem Text, `aiOrigin`-Badge.
