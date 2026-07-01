## Problem

Die Freitext-Anfrage wurde korrekt an `parse-freeform-offer` gegeben und in `menuSelection.days[0].courses[]` als Custom-Items gespeichert (DB-Check bestätigt: `itemName="Aperitif-Getränke und Fingerfood"`, `"3 Abendessengänge"`, `"3 Gläser Wein/Person"`, `"Kaffee, Wasser"`, alle mit `isCustom: true`, `itemId: null`).

Zwei sichtbare Probleme:

1. **UI zeigt Platzhalter statt Custom-Name.** `InlineCourseEditor` rendert für jede Zeile den `DishPicker` mit `value={course.itemId ? {…} : null}`. Da Freitext-Items kein `itemId` haben, sieht der Operator "Abendessen wählen…" — obwohl der Name in der DB steht. Der Bearbeiten-Stift erscheint auch nur, wenn `course.itemId && course.itemName` gesetzt sind, also nie für Freitext-Items.

2. **Preise fehlen.** Text "Budget 90 € pro Person" wurde vom Parser nicht als `meal.pricePerPersonNet=90` erkannt, deshalb kein `overridePrice` auf den Items.

## Fix

### 1. `InlineCourseEditor.tsx` — Custom-Items korrekt anzeigen

Im Namens-Slot (Zeile ~308-353): Wenn `course.isCustom && course.itemName && !course.itemId`, statt `DishPicker` einen bearbeitbaren Text-Chip rendern:

- Klickbar → wechselt in Input-Modus (`editingName`, existiert schon).
- Zeigt den `itemName` als Text mit dezentem Border, Pencil-Icon rechts.
- Optional: kleiner "Katalog-Suche"-Button, der auf DishPicker umschaltet (setzt `isCustom=false`, öffnet Picker).

Bearbeiten-Pencil-Bedingung (Zeile 341) lockern: auch anzeigen wenn `course.isCustom && course.itemName` (nicht nur bei `itemId`).

### 2. `parse-freeform-offer/index.ts` — Prompt-Regel ergänzen

Regel 12 präzisieren: "Auch Formulierungen wie 'Budget X € pro Person', 'X € p.P.', 'inklusive X € pro Person' zählen als pricePerPersonNet=X auf der Mahlzeit. Prefix leer lassen, außer der Text sagt explizit 'ab'/'ca.'."

### 3. `freeformToMenuDays.ts` — kleines Follow-up

`courseLabel` intelligenter setzen: wenn `heading` fehlt, statt `meal.label` (führt zu 4× "Abendessen") die `COURSE_TYPE_LABELS[courseType]` (Vorspeise, Hauptgang, Dessert …) benutzen. `meal.label` bleibt weiter als Tages-/Meal-Titel im Tab.

## Technische Details

Betroffene Dateien:
- `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx` (Render-Zweig für Custom-Items + Pencil-Bedingung)
- `supabase/functions/parse-freeform-offer/index.ts` (Prompt-Regel 12 erweitern, Deploy)
- `src/components/admin/refine/InquiryEditor/OfferBuilder/freeformToMenuDays.ts` (courseLabel-Fallback)

Keine DB-Migration, keine Änderung an `useOfferBuilder` — die bestehenden Daten der Anfrage werden nach dem Fix sofort korrekt gerendert (Reload reicht).

## Testfall

Text: *"Anfrage für ein Abendessen für NovoNordisk am 28. August für 19 Personen um 19:30 Uhr, inklusive 3 Gänge, Wein, Aperitif und Fingerfood. Budget 90€ pro Person."*

Erwartet nach Fix:
- 4 Zeilen mit sichtbaren Custom-Namen (Aperitif-Getränke und Fingerfood / 3 Abendessengänge / 3 Gläser Wein/Person / Kaffee, Wasser).
- Pencil-Icon zum Umbenennen sichtbar.
- Auf einer Zeile ein `overridePrice=90 /Pers.` (durch die neue Parser-Regel).
- Gang-Labels: Aperitif → "Vorspeise", die anderen → "Hauptgang" statt 4× "Abendessen".
