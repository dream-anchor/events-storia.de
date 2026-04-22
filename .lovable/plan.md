

# Gäste-Mengen-UI im Public Offer kontextabhängig zeigen

## Befund

Aktuell zeigt jede Option einen Mengen-Stepper „Wie viele Gäste möchten dieses Menü?" — **auch wenn nur eine Option existiert**. Das ist verwirrend: Bei nur einer Option ist die Menge bereits durch `inquiry.guest_count` definiert, der Kunde sollte einfach direkt buchen können.

Bei mehreren Optionen fehlt umgekehrt die wichtigste Info: **wie viele Gäste muss ich noch verteilen?** Es gibt kein Ziel und keinen Fortschrittsindikator.

## Lösung

### 1) Single-Option: Stepper komplett ausblenden

Wenn `options.length === 1`, wird der Stepper-Block (`PublicOffer.tsx` ~Zeile 1194-1241) gar nicht gerendert. Die Menge wird intern automatisch auf `inquiry.guest_count` (numerisch geparst) gesetzt, sodass die Backend-Logik (`optionQuantities`-Pfad in `create-payment-session`) unverändert weiter funktioniert. Falls `guest_count` nicht parsebar ist (z.B. „20-30"), Fallback auf `option.guest_count`.

Der gesamte Live-Summary-Block („Ihre Auswahl · X Gäste gesamt") wird ebenfalls ausgeblendet — bei einer Option ist das redundant.

### 2) Multi-Option: Pflichtfeld + Fortschritts-Anzeige

**Ziel-Gästezahl** wird einmal aus `inquiry.guest_count` geparst (z.B. „40" → 40, „20-30" → 30 als Maximum). Falls nicht parsebar, kein hartes Ziel — dann nur Live-Summe ohne Fortschritt anzeigen.

**Live-Summary-Box** (oberhalb der Buchungs-Card) erweitert um:
- Progress-Bar: `totalQuantity / targetGuests`
- Status-Text:
  - `totalQuantity < target` → „Es fehlen noch **N Gäste** von insgesamt **40**" (in subtilem Warn-Ton, aber monochrom — kein Gelb/Grün)
  - `totalQuantity === target` → „✓ Alle 40 Gäste verteilt"
  - `totalQuantity > target` → „**N Gäste über** der ursprünglich angefragten Menge (40)" (informativ, nicht blockierend)

**Pflicht-Validierung im Buchen-Button**: 
- Buttons „Voll bezahlen" / „Anzahlung" sind disabled, solange `totalQuantity === 0`
- Wenn `target` bekannt und `totalQuantity < target`: Button bleibt klickbar, aber unter dem Button erscheint Hinweis: „Sie können auch mit Teilmenge buchen — restliche Gäste später ergänzen." Das hält den CX-Flow flüssig (kein harter Block, da Geschäftslogik Teilbuchungen erlaubt).
- Wenn `totalQuantity === 0`: Button-Text wechselt zu „Bitte Mengen pro Option angeben"

### 3) Kontext-Hint pro Options-Card (nur Multi-Mode)

Im Stepper-Block der Card der zweite Sub-Text wechselt:
- Single-Mode: (Stepper ausgeblendet, kein Text)
- Multi-Mode, kein Ziel: „Ergibt {preis} für diese Option" (wie bisher)
- Multi-Mode, mit Ziel: „Ergibt {preis} · noch **{remaining}** von **{target}** zu verteilen"

## Geänderte Dateien

- `src/pages/PublicOffer.tsx` — Logik in `ProposalView` (Auto-Quantity bei Single, Target-Parsing, Progress-Anzeige) + bedingtes Rendering im Stepper-Block der `ProposalOptionCard`. ~50 Zeilen Diff, keine neuen Komponenten nötig.

## Nicht geändert

- `create-payment-session` Edge Function: bekommt weiterhin `optionQuantities` mit der korrekten Auto-Menge bei Single — vollständig abwärtskompatibel.
- DB / Migrationen: keine.
- Andere Public-Offer-Subviews (`ThankYouView`, `BookedView`): unberührt.

## Verifikation

1. Public Offer mit **einer Option**, `guest_count='20'`: kein Stepper sichtbar, Buttons zeigen sofort `total_amount` für 20 Gäste, Klick → Stripe-Session korrekt erstellt.
2. Public Offer mit **mehreren Optionen**, `guest_count='40'`: Live-Bar zeigt „Es fehlen noch 40 von 40". Stepper auf Option A → 25, Option B → 10 → Bar zeigt „Es fehlen noch 5 von 40", Button aktivierbar.
3. Aufsummiert > 40 → Hinweis „über angefragter Menge", Button bleibt klickbar.
4. `guest_count='20-30'` (Range) → Target = 30, Progress funktioniert.
5. `guest_count` leer/null → kein Target-Text, nur Live-Summe.

