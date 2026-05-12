## Ziel

Der LexOffice-Beleg soll im **Paket-Modus** exakt das spiegeln, was in MAESTRO sichtbar ist:

- **Hauptzeile:** `Network-Aperitivo` — 10 × 69,00 € = **690,00 €** (7 % MwSt)
- **Beschreibung darunter:** Auflistung aller im Paket enthaltenen Speisen & Getränke mit „inkl."-Markierung
- **Equipment / Personal** weiterhin als eigene Positionen mit 19 % MwSt

## Heutiges Verhalten (Bug)

In `supabase/functions/create-event-quotation/index.ts` Zeile 437–485 (Paket-Modus):

1. Es wird **nur eine Sammelzeile** „Veranstaltungspaket / Paketname" erzeugt — ohne Hinweis auf enthaltene Speisen/Getränke.
2. Der Pro-Person-Preis wird aus `total_amount / guestCount` berechnet. In V1 stand `total_amount = 849 €` (weil die Caprese mit `overridePrice = 15,90 €` als Aufschlag gerechnet wurde), daher 84,90 €/Person statt der angezeigten 69 €.
3. Die in der UI als „inkl." markierten Items (Caprese, Cocktail, Bier, Wasser, Kaffee) tauchen im LexOffice-Beleg gar nicht auf.

## Änderungen

### 1. `paket`-Modus: enthaltene Items in `description` der Hauptzeile bündeln

Im else-Zweig (Zeile 437+) zusätzlich vor dem `items.push(...)`:

```text
description = "Inklusive:
• Antipasto: Caprese mit Büffelmozzarella
• Aperitif: Cocktail (1 pro Person)
• Getränk: Bier
• Wasser: still, sparkling (1 Flasche pro Person)
• Kaffee-Spezialität (1 pro Person)"
```

Quelle: `menu_selection.courses[]` (Speisen) und `menu_selection.drinks[]` (Getränke). Pro Eintrag: Label (Antipasto, Aperitif, …) + ausgewählte Auswahl + ggf. `quantityLabel`. Custom-Drinks (`customDrink`) ebenfalls einbeziehen.

### 2. Pro-Person-Preis aus `budgetPerPerson` ableiten (statt aus Summe)

```text
Wenn ms.packageNameOverride und ms.budgetPerPerson > 0:
   unitPriceBrutto = budgetPerPerson
Sonst (Fallback heute):
   unitPriceBrutto = (totalAmount − equipStaffTotal) / guestCount
```

Damit erscheint im Beleg `10 × 69,00 € = 690,00 €` (statt 84,90 €). `total_amount` in der DB wird beim nächsten Senden bereits korrekt mit 690 € gespeichert — die Korrektur greift also automatisch für V2 und alle künftigen Versionen.

### 3. Course-`overridePrice` im Paket-Modus NICHT als Aufschlag rechnen

Der heutige Bug — `overridePrice` der Caprese (15,90 €) wurde additiv ins `total_amount` aufaddiert (V1: 690 + 159 = 849) — kommt aus dem Preis-Berechner in `useOfferBuilder.ts` / `pricingMode.ts`. Im **Paket-Modus** ist eine Speise mit konfiguriertem `overridePrice` **„im Paket inkludiert"** (UI zeigt explizit „inkl."), darf also nicht aufgeschlagen werden.

Anpassung in der Brutto-Berechnung (frontend `pricingMode.ts`): Wenn `offer_mode === 'paket'` und `packageNameOverride` gesetzt ist → Course-`overridePrice`-Werte ignorieren (nur als Anzeige-Info, nicht in Summe). Bestehende Menü-/Catering-Modi bleiben unverändert.

### 4. Keine Re-Migration alter Belege

V1 (AG0105) bleibt wie gesendet (849 €) — Belege sind immutable. Korrektur greift erst für V2, V3, neue Anfragen.

## Technische Details

**Betroffene Dateien:**

- `supabase/functions/create-event-quotation/index.ts` — `buildLineItems` Paket-Branch + neue `buildPackageDescription`-Helper
- `src/components/admin/refine/InquiryEditor/OfferBuilder/pricingMode.ts` (oder `useOfferBuilder.ts`) — Override-Aufschlag im Paket-Modus deaktivieren
- ggf. `PriceBreakdown.tsx` — UI-Konsistenz prüfen (zeigt bereits 690 € korrekt)

**Datenquelle für Beschreibung** (aus `menu_selection`-Snapshot):

```text
courses[].courseLabel + itemName
drinks[].drinkLabel + (selectedChoice || customDrink) + (quantityLabel)
```

**Nicht angefasst:** `per_event`-Pricing (Zeile 110–243), `menu`-Modus (Zeile 246+). Beide listen Items bereits korrekt einzeln auf.

## Verifizierung

Nach Deploy: V2 in MAESTRO senden → LexOffice-Beleg AG0106 muss zeigen:

```text
1 | Network-Aperitivo | 10 | Person | 69,00 | 690,00
    Inklusive:
    • Antipasto: Caprese mit Büffelmozzarella
    • Aperitif: Cocktail (1 pro Person)
    • Getränk: Bier
    • Wasser: still, sparkling (1 Flasche pro Person)
    • Kaffee-Spezialität (1 pro Person)

Gesamtbetrag: 690,00 € (Netto: 644,86 €, USt 7 %: 45,14 €)
```
