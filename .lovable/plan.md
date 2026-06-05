## Tatsächliche Ursache (Datenanalyse AG0146)

Die LexOffice-Account-Einstellung „Brutto-Preise" ist korrekt aktiv und der API-Payload nutzt korrekt `taxType: 'gross'` + `grossAmount`. Das ist **nicht** das Problem.

Aus den Daten von Option A (`inquiry_offer_options`):

- Roastbeef `overridePrice = 54,00 €` (Brutto), `quantity = 3`
- LexOffice-PDF zeigt aber `48,60 € × 3 = 145,80 €`
- Faktor: `48,60 / 54,00 = 0,90` → entspricht exakt `menu_selection.discountPercent = 10`
- Gleiches Muster bei allen anderen Positionen (52 → 46,80, 49 → 44,10, 65 → 58,50, 5,2 → 4,68, …)

In `supabase/functions/create-event-quotation/index.ts` Zeilen **256–273** („Proportionale Korrektur") werden alle skalierbaren Einzelpreise mit einem Faktor multipliziert, damit die LexOffice-Linientotale exakt `opt.total_amount` (= bereits rabattierter Brutto-Gesamtbetrag) ergeben. Dadurch wird der 10 % Rabatt **stillschweigend in jeden Einzelpreis eingerechnet** statt als eigene Rabattzeile auszuweisen.

Der Kunde sieht im Angebot (Public Offer) die Originalpreise (54,00 €) plus eine ausgewiesene Rabattzeile — in LexOffice sieht er aber 48,60 €. Das wirkt wie „Netto", ist aber tatsächlich „Brutto nach versteckter Rabattanwendung".

Auch die Regel „**Maestro ist Single Source of Truth — niemals recalculate/round/split**" wird durch dieses Re-Scaling verletzt.

## Fix

In `create-event-quotation/index.ts`:

1. **Proportionale Korrektur entfernen** (Zeilen 256–273 löschen). Jeder Eintrag behält seinen originalen `overridePrice` als `grossAmount`.

2. **Stattdessen eine Rabattzeile pro Steuersatz anhängen**, wenn `ms.discountPercent > 0` oder `ms.discountAmount > 0`:
   - Aus den summierten Brutto-Linientotalen pro Steuersatz (7 % Speisen, 19 % Getränke/Equipment/Staff) den Rabatt-Brutto-Betrag berechnen.
   - Zwei (oder eine) negative LexOffice-Positionen einfügen:
     - `name: "Rabatt 10 % (Speisen)"`, `quantity: 1`, `unitPrice.grossAmount: -X`, `taxRatePercentage: 7`
     - `name: "Rabatt 10 % (Getränke/Equipment)"`, `quantity: 1`, `unitPrice.grossAmount: -Y`, `taxRatePercentage: 19`
   - Bei `discountAmount` (fester Eurobetrag) proportional auf beide Steuersätze aufteilen.

3. **Konsistenz-Check**: Summe (Linien + Rabattzeilen) muss exakt `opt.total_amount` ergeben. Verbleibende Rundungsdifferenz (max. ±0,01 €) wird auf die letzte Rabattzeile gelegt.

4. Funktioniert sowohl für `pricingMode: 'per_event'` (Zeilen 167–301) als auch für den Menü-Modus (Zeilen 304–500) — daher Hilfsfunktion `appendDiscountLines(items, discountPercent, discountAmount)` einführen und in beiden Pfaden aufrufen.

## Erwartetes Resultat im LexOffice-PDF nach Fix

Für AG0146 würde stehen:

```
6  Roastbeef mit Parmesanhobel           3  Portion   54,00   162,00
…
   Zwischensumme (Brutto)                                   1.171,10
   Rabatt 10 % (Speisen)                                    −106,11
   Rabatt 10 % (Getränke/Equipment)                          −10,99
   Gesamtbetrag*                                            1.053,99
```

Damit stimmen LexOffice-Einzelpreise 1:1 mit den Preisen im Public Offer überein, und der Rabatt ist transparent ausgewiesen — wie es der Memory-Regel entspricht („immer 1:1 aus Maestro, niemals umrechnen").

## Betroffene Dateien

- `supabase/functions/create-event-quotation/index.ts` (proportionale Korrektur entfernen, Rabattzeilen-Helper hinzufügen, in beiden Modi nutzen)
- Optional Memory-Update unter `mem://integrations/lexoffice-gross-pricing`, dass Rabatt als Linie ausgewiesen wird, nicht auf Einzelpreise verteilt.

Keine Migration, keine UI-Änderung, keine Auswirkungen auf bereits gesendete Angebote.
