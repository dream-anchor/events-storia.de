# Rabatt nur EINMAL im Anschreiben

## Problem
Aktuell taucht der Rabatt 2–3× auf:
1. Im Eröffnungssatz mit Preis ("Im Endpreis ist bereits ein Rabatt … berücksichtigt – statt 1.171,09 € … 1.053,99 €.")
2. Im dedizierten Rabatt-Satz unten ("Gerne räumen wir Ihnen …")
3. Ggf. zusätzlich durch die Rabatt-Absicherung im Post-Processing.

Grund: Regel 7 des System-Prompts lässt zwei freundliche Formulierungen zu und sagt nicht klar, dass der Eröffnungssatz nur den Endpreis ohne Vergleich nennen darf.

## Fix
Anpassung in `supabase/functions/generate-inquiry-email/index.ts`:

### 1. Regel 7 (RABATT) verschärfen
- Genau **EIN** Rabatt-Satz im gesamten Anschreiben, **direkt vor dem Link-Absatz**.
- Der Eröffnungs-/Preissatz nennt **nur** den Endpreis als Zahl — **keine** Zwischensumme, **kein** "statt … berücksichtigt", **kein** Prozentsatz.
- Nur eine einzige zugelassene Formulierung im Rabatt-Satz (die "Gerne räumen wir …"-Variante). Die "Im Endpreis ist bereits …"-Variante streichen, weil sie dazu verleitet, oben erneut Zwischensumme + Endpreis zu nennen.
- Negativbeispiel ergänzen: „statt 1.171,09 € beträgt Ihr Endpreis 1.053,99 €" im Eröffnungssatz = FALSCH.
- Positivbeispiel: Eröffnungssatz nennt nur „1.053,99 €", Rabatt-Satz unten erklärt %-Satz + Zwischensumme.

### 2. Rabatt-Absicherung (Post-Processing) robuster
Aktuell fügt sie einen Rabatt-Satz ein, sobald der Endpreis nicht gefunden wird. Anpassung:
- Nur ergänzen, wenn der Text **noch keinen** Hinweis auf den Rabatt enthält. Match-Heuristik: Treffer auf `Rabatt` (case-insensitive) im Anschreiben.
- Damit kann sie nicht zusätzlich zur AI-Erwähnung einen dritten Satz produzieren.

### 3. Edge Function deployen
`generate-inquiry-email` redeployen.

## Nicht enthalten
- Keine Änderung an Preis-Logik, Daten oder Kontext-Aufbau.
- Keine UI-Änderungen.

## Betroffene Datei
- `supabase/functions/generate-inquiry-email/index.ts` (Regel 7 + Rabatt-Absicherungs-Check)
