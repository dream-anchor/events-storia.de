## Ziel
Beim Anlegen einer neuen Anfrage in Schritt 1 („Kunden-E-Mail einfügen") wird der eingegebene Text nicht nur durch den Kontakt-/Event-Parser geschickt, sondern parallel auch durch den Freitext-Offer-Parser. Erkennt dieser eine Menü-/Tagesstruktur, wird beim Übergang in den Editor automatisch eine Option A als KI-Vorschlag vorbereitet (aiOrigin, needsManualSave) — mit `menuSelection.days[]`, so wie ein handgemachtes Menü mit Tages-Tabs aussieht.

## Verhalten

### Schritt 1: Text-Analyse
- „Mit KI analysieren"-Button startet WEITERHIN nur einen sichtbaren Ladezustand, aber im Hintergrund laufen **beide** Edge-Functions parallel:
  - `parse-inquiry-text` (heute) → Kontakt, Datum, Gäste, Paket-Suggestions
  - `parse-freeform-offer` (neu im Intake) → FreeformProgram JSON, falls Menü/Preise erkennbar
- Ergebnis von `parse-freeform-offer` wird **nicht** blockierend — schlägt der Parse fehl, wird still weiter navigiert. `parse-inquiry-text` bleibt der harte Erfolgs-Pfad.
- Findings des Red-Team-Validators werden hier NICHT ausgeführt (schnellerer Intake). Validierung kann der Operator im Editor über den regulären Freitext-Import erneut anstoßen.

### Draft-Persistenz
- Wenn `parse-freeform-offer` ein sinnvolles Programm liefert (mind. 1 Tag mit ≥1 Item ODER Pauschale > 0), wird es zusammen mit dem Draft in einer neuen Spalte `event_inquiries.pending_freeform_program jsonb` persistiert.
- Kein sinnvolles Programm → Spalte bleibt NULL.
- Migration liefert die Spalte + Kommentar; keine Indizes nötig.

### Hand-off in den Editor
- Beim Übergang zum Editor prüft `useOfferBuilder` beim ersten Load nach Options-Daten: wenn keine Options existieren (frische Anfrage) UND `inquiry.pending_freeform_program` gesetzt ist, wird eine Option A als KI-Preview eingefügt:
  - `applyFreeformAsMenu` (aus Session 2) baut `menuSelection.days[]`
  - `offerMode='menu'`, `aiOrigin=true`, `needsManualSave=true`
  - Kein Auto-Save → Operator muss aktiv „KI-Vorschlag speichern" klicken (bestehender Flow)
- Nach dem ersten Save wird `pending_freeform_program` in derselben Row auf NULL gesetzt (idempotent).

### UI-Feedback in Schritt 1
- Wenn Freitext-Parse erfolgreich war, zeigt Schritt 2 einen dezenten Hinweis-Badge: „KI hat auch ein Menü-Programm erkannt — als Vorschlag im Editor bereit". Kein Modal, kein Blocker.
- Wenn der Parse fehlgeschlagen ist, kein UI-Feedback (still).

## Technische Details

### Neue Migration
- `alter table event_inquiries add column pending_freeform_program jsonb;`
- Kommentar erklärt Nutzung + Auto-Cleanup-Regel.
- Keine RLS-Änderung nötig (bestehende Policies decken Spalte ab).

### Änderungen in `OfferCreate/index.tsx`
- `handleExtract` startet beide Invokes via `Promise.allSettled`.
- Extractor-Ergebnis wie heute (harte Fehlerbehandlung).
- Freitext-Ergebnis: bei Erfolg + Non-Trivial-Programm → in Draft-Auto-Save mit übergeben (`pending_freeform_program`).
- Neues State-Flag `freeformDetected: boolean` für den Badge in Schritt 2.

### Änderungen in `useOfferBuilder.ts`
- Load-Pfad: wenn `optionsData.length === 0` UND `inquiry.pending_freeform_program` gesetzt → statt „leere Option A anlegen" wird eine Preview-Option via `applyFreeformAsMenu` erstellt, mit `aiOrigin=true`, `needsManualSave=true`. Analog zum bestehenden `addAiDraftPreview`-Pfad.
- In `saveOptions` (oder direkt beim manuellen „Vorschlag speichern"): nach erfolgreichem ersten Save der Preview-Option auch `event_inquiries.pending_freeform_program = null` schreiben.

### Kosten & Rate-Limit
- Zwei parallele AI-Calls pro Intake statt einem. `parse-freeform-offer` ist der teurere Call (Gemini + optionaler Validator). Validator läuft hier NICHT (nur Parser) → +1 Call, keine Verdopplung.
- 402/429-Fehler beim Freitext-Parse werden geschluckt (nur Logging).

## Nicht-Ziele
- Kein Red-Team-Validator im Intake (Zeit- und Kosten-Grund).
- Keine automatische Persistierung der Option (Operator entscheidet immer bewusst).
- Kein Retry-Loop im Intake — der Editor-Freitext-Import behält die volle Pipeline inkl. Retry.
- Kein neues Modal / kein Wizard-Extra-Schritt.

## Dateien (voraussichtlich)
- `supabase/migrations/YYYYMMDDHHMMSS_add_pending_freeform_program.sql` (neu)
- `src/components/admin/refine/OfferCreate/index.tsx` (parallel invoke + Draft-Feld + Badge)
- `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts` (Preview-Injection + Cleanup)
- optional: `src/pages/public-offer/types.ts` / Refine-Types falls `pending_freeform_program` typisiert werden soll
