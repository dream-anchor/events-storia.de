## Problem (kurz)

Maestro hat zwei Ebenen:
1. **Einzelpositionen** (Lunch, Dinner, Personal, Equipment …) — Summe brutto = **28.460,84 €**
2. **Maestro-Endpreis** (manuell gesetzt) = **25.000,00 €**

Aktuell schicken wir nur Ebene 1 an LexOffice. Die Differenz von **3.460,84 €** (= verhandelter Rabatt / Endpreis-Anpassung) fehlt → LexOffice zeigt 28.460,84 € statt 25.000 €.

## Lösung

In `supabase/functions/create-event-quotation/index.ts` (und `repair-quotation-pricing`) eine **Abgleichs-Zeile** an LexOffice anhängen, sobald `Σ(LineItems brutto) ≠ Maestro total_amount`.

### Logik

```text
delta = round2( Σ(lineItems.gross) - maestro.total_amount )

if |delta| < 0,01 €  → nichts tun
if delta > 0         → Rabatt-Zeile mit -delta (Bezeichnung: "Rabatt / Endpreis-Anpassung")
if delta < 0         → Aufpreis-Zeile mit +|delta| (Bezeichnung: "Anpassung")
```

### Steuer-Aufteilung der Anpassung

Damit Netto- und Brutto-Summen in LexOffice exakt zu Maestro passen, wird die Anpassung **anteilig pro VAT-Rate** verteilt (gewichtet nach Brutto-Anteil je Steuersatz):

```text
für jede vorkommende vatRate r:
  weight_r = Σ(lineItems[vat=r].gross) / Σ(lineItems.gross)
  adjustment_r_gross = delta * weight_r
  adjustment_r_net   = adjustment_r_gross / (1 + r/100)
  → eine LexOffice-Zeile pro vatRate
```

Das verhindert, dass die 19%-/7%-Aufteilung in der LexOffice-Rechnung von Maestro abweicht.

### Wo greift das?

- `buildLineItems()` — am Ende, **nach** allen Maestro-Positionen (Meals, Personal/Equipment).
- Gilt für alle drei Pfade: `freeformProgram`, `per_event`, klassische Menü-Pakete.
- Die existierende `appendDiscountLines()` wird auf die obige Logik vereinheitlicht (eine Funktion, alle Pfade).

### Quelle des Zielwerts

`maestro.total_amount` (brutto, immutable, Single Source of Truth gemäß Core-Memory). **Nie** neu berechnen, nur 1:1 als Zielwert verwenden.

### Validierung vor dem Senden

Hard-Check direkt vor dem LexOffice-Call:

```text
assert |Σ(lineItems.gross) - maestro.total_amount| < 0,01 €
```

Bei Verletzung: Fehler werfen statt falsche Rechnung erzeugen.

## Auswirkung auf AG0175

Vorher:
```
Lunch                450,00
Dinner Live Cooking  796,00
…
Personal/Equipment 4.105,50
                  ---------
Summe brutto      28.460,84 €   ← in LexOffice
```

Nachher:
```
Lunch                  450,00
Dinner Live Cooking    796,00
…
Personal/Equipment   4.105,50
Rabatt / Endpreis-Anpassung (19%)  -2.962,xx
Rabatt / Endpreis-Anpassung (7%)     -498,xx
                                ----------
Summe brutto         25.000,00 €   ← matcht Maestro
```

## Backfill (optional, separat)

Für bereits in LexOffice existierende, abweichende Angebote: `repair-quotation-pricing` einmalig je betroffenem Angebot aufrufen — sie werden neu erzeugt (vorhandene Versionierung bleibt unangetastet, da Maestro-Daten unverändert).

## Was NICHT geändert wird

- Keine DB-Migration.
- Keine Maestro-Logik.
- Keine UI-Änderung.
- Keine Email-Texte.
- Brutto-Modus in LexOffice (`taxType='gross'`) bleibt — gemäß Memory.
