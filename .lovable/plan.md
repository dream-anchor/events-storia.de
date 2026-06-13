# LexOffice Brutto-Drift beheben

## Ursache (gefunden)

In `supabase/functions/create-event-quotation/index.ts` werden alle Positionen intern korrekt als Brutto (`grossAmount`) aufgebaut. **Vor dem Senden an LexOffice** werden sie aber durch `convertLineItemsToNet()` (Zeile 854) in Netto umgerechnet und mit `taxType: 'net'` (Zeile 1293) übergeben.

Diese Umrechnung verursacht einen Rundungsdrift:

```
budgetPerPerson (Brutto) = 30,01 €
30,01 / 1,07 = 28,0467… → round2 = 28,05 €  (netto pro Person)
28,05 × 833 Gäste = 23.365,65 €  (netto)
23.365,65 × 1,07 = 25.001,2455 → 25.001,25 € (brutto)
```

Soll-Brutto wäre `30,01 × 833 = 25.000,33`, nach Rundung 25.000 € — angezeigt werden aber **25.001,25 €**. Genau das auf dem Screenshot.

Das verletzt zusätzlich zwei Memory-Regeln:
- **„LexOffice Brutto-Preise: taxType='gross' + grossAmount, niemals manuell konvertieren"**
- **„Maestro ist Single Source of Truth: Preise/Totals 1:1, niemals umrechnen oder runden"**

Betroffen sind alle Angebote/Rechnungen, die diese Funktion erzeugt — Pakete, Menü-Komposition, Freitext-/KI-Angebote, Anzahlungs- und Schlussrechnungen.

## Fix

In `supabase/functions/create-event-quotation/index.ts`:

1. **`convertLineItemsToNet()` nicht mehr anwenden** beim `documentPayload`. LineItems werden so an LexOffice gesendet, wie sie intern (brutto) aufgebaut werden.
2. **`taxConditions: { taxType: 'gross' }`** statt `'net'`.
3. Die Funktion `convertLineItemsToNet()` selbst entfernen (oder als deprecated markieren), damit sie nicht versehentlich wieder verwendet wird.
4. **Freshness-Probe anpassen** (Zeile 991–993): `taxTypeMatches = lexTaxType === 'gross'` — sonst werden alle bestehenden „gross"-Belege als „drift" angesehen und neu erzeugt.

Die LexOffice-PDF zeigt dann weiterhin Netto-Spalten, MwSt. und Brutto-Summe — LexOffice rechnet aus dem gesendeten `grossAmount` automatisch korrekt zurück, **ohne Rundungsdrift auf der Brutto-Summe**.

## Validierung

Nach dem Fix:
- Neues Vorschau-Angebot AG für Inquiry `6ddaabe0-…` öffnen → Gesamtbetrag muss exakt der Maestro-Summe entsprechen (25.000 € bzw. 833 × `budgetPerPerson`).
- Kurzer Check: `lex-inspect` (existierende Edge-Function) gegen die neu erzeugte Quotation aufrufen, `taxConditions.taxType` und `totalPrice.totalGrossAmount` prüfen.

## Scope / nicht enthalten

- Keine Änderungen an Maestro-Eingabe, PublicOffer oder Stripe-Logik.
- Keine Migration nötig.
- Keine nachträgliche Korrektur bereits an Kunden versendeter LexOffice-Belege (das wäre ein separater manueller Schritt; falls gewünscht, in einem Folge-Task).
