## Problem

Beim Versand eines Freitext-Import-Angebots (KI) erzeugt das Anschreiben unsinnige Sätze:

- "für 833 Gäste" → Summe aller Mahlzeit-Gästezahlen (25+24+24+120+100+120+200+100+120) — es gibt aber pro Tag/Mahlzeit unterschiedliche Gästezahlen.
- "34,16 € pro Person" → 28.460,84 € / 833 — bei einem Mehrtages-Programm mit unterschiedlichen Personenzahlen pro Mahlzeit gibt es **keinen** sinnvollen Pro-Person-Preis.
- "noch keine Menüs oder Pakete konfiguriert" → die KI sieht die Programm-Daten gar nicht.
- Datum nur "29. Juni 2026" statt "29.06.–02.07.2026".

## Ursache

`supabase/functions/generate-inquiry-email/index.ts` kennt nur zwei Pfade: `offer_mode === 'menu'` (Menügänge) und Paket. Für `offer_mode === 'freeform'` werden weder `freeformProgram.days/meals/scopeOfServices/notes/totalsFromText` aus `menu_selection` extrahiert noch dedizierte Prompt-Regeln gesetzt — die Option wird wie ein leeres Paket behandelt.

## Plan

### 1. Freitext-Daten in den KI-Kontext einspeisen

Datei: `supabase/functions/generate-inquiry-email/index.ts`

- In `buildMultiOfferContext` (bzw. der Mapping-Funktion bei `isOfferBuilderRequest`) erkennen, wenn `offerMode === 'freeform'` und dann statt der Menü/Getränke-/Equipment-Logik einen Freitext-Block ausgeben:
  - `title`, `dateRangeLabel`, `location` aus `freeformProgram`
  - `scopeOfServices` als Aufzählung
  - Pro Tag: Datum + Wochentag, dann je Mahlzeit: Name, Personen, `pricePerEvent` netto, MwSt-Hinweis, alle `items` (mit Section-Headers)
  - `notes` (Hinweise) 1:1
  - `taxBreakdown` (Speisen netto/MwSt, Personal/Equipment netto/MwSt), `totalsFromText.net/gross`, Rabatt, **Endbetrag brutto** (1:1 aus Maestro, niemals neu berechnen)
- Beim Mapping in `multiOpts` ein Flag `isFreeform` und ein Feld `freeformProgram` mitführen.

### 2. Pro-Person-/Gästezahl-Falle entschärfen

- Bei Freitext **keine** Gesamtgästezahl ableiten und **keinen** Pro-Person-Preis berechnen. Stattdessen die unterschiedlichen Mahlzeit-Gästezahlen so anbieten, wie sie sind.
- `guestCount` der Option bleibt für die DB (z. B. Anzahl der größten Mahlzeit), wird aber im Kontext explizit als "variabel je Mahlzeit" markiert.

### 3. System-Prompt erweitern

Neuer Regelblock im `systemPrompt` (nur aktiv, wenn mindestens eine Option Freitext ist):

- "FREITEXT-PROGRAMM: Das Angebot deckt mehrere Tage / Mahlzeiten mit unterschiedlichen Gästezahlen ab."
- Anschreiben muss enthalten: Anrede → Bezug auf Anlass + **Datumsspanne** + Location → kurze Übersicht "X Tage, Y Mahlzeiten" → pro Tag eine kompakte Aufzählung der Mahlzeiten (Name + Personen + Preis) → Endbetrag brutto (exakt aus Maestro) → Hinweise (Finale Gästezahl bis 7 Tage etc.) → Zahlungsart → Link.
- Verbot: keinen Pro-Person-Preis erfinden, keine Gesamt-Gästezahl summieren, niemals "noch keine Menüs konfiguriert" schreiben, wenn `freeformProgram.days` existiert.
- Preise/Endbetrag brutto strikt 1:1 aus Maestro.

### 4. Verifikation

- Edge Function neu deployen und manuell mit der bestehenden Anfrage (DataGuard – Spike Week 2026) erneut "Anschreiben generieren" auslösen.
- Erwartetes Ergebnis: Anschreiben nennt 29.06.–02.07.2026, AAHHH Werksviertel, listet die 4 Tage mit ihren Mahlzeiten/Personen, nennt 25.000,00 € als Endbetrag, übernimmt die 5 Hinweise sinngemäß, kein Pro-Person-Preis, keine erfundenen 833 Gäste.

## Technische Details

- Betroffene Datei: nur `supabase/functions/generate-inquiry-email/index.ts` (Mapping + `buildMultiOfferContext` + `systemPrompt`).
- Datenquelle: `inquiry_offer_options.menu_selection.freeformProgram` (bereits in DB vorhanden, siehe `OptionCard.tsx` Zeile 602/608).
- Kein DB-Schema-Change, keine Frontend-Änderung nötig.
- Maestro-Quelle-der-Wahrheit-Regel: Endbetrag brutto = `option.total_amount` (bzw. `freeformProgram.totalsFromText.gross - discount`), niemals aus Mahlzeiten neu summieren.

## Nicht im Scope

- Übersetzung des Anschreibens (läuft separat über `translate-offer-letter`).
- Red-Team-Validator für das Anschreiben selbst (nur Parser hat Validator).
