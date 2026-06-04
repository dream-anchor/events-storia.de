## Befund

Die Rechnung RE0027 wurde um **23:18** erzeugt. Der Fix in `create-event-quotation` (per_event-Modus: echte `quantity` × `unitPrice` statt vorformatiertem `"3 × Name"`-Workaround) wurde aber erst um **23:54** committed (`dcd3f313` → `7d6fc37d`).

→ Das Code-Problem existiert nicht mehr. RE0027 ist nur ein „Altbestand" aus den letzten 36 Minuten vor dem Fix.

Vor dem Fix:
```
name: "3 × Vitello Tonnato-Platte", quantity: 1, unitPrice: 156 €
```

Nach dem Fix (per_event-Branch, Lines 167–302):
```
name: "Vitello Tonnato-Platte", quantity: 3, unitPrice: 52 €
```

LexOffice-API-Response bestätigt: RE0027 ist noch im alten Format. DB-Daten (`overridePrice: 52`, `quantity: 3`) sind dagegen sauber.

## Plan

Nichts am Code zu ändern — RE0027 muss nur **storniert und neu erzeugt** werden, damit die korrekte Darstellung im PDF landet.

### Schritte (in der Anfrage `a14872bb-…`)

1. **RE0027 stornieren**
   Im Beleg-Drawer (siehe Screenshot) auf **„Stornieren"** klicken. Das erzeugt automatisch eine Stornorechnung in LexOffice (`void-lexoffice-invoice`) und setzt `v2_events.final_lexoffice_invoice_id` zurück.

2. **Schlussrechnung neu erzeugen**
   Über den bestehenden Trigger („Schlussrechnung erzeugen" bzw. den automatischen Flow nach Zahlungseingang) → ruft `create-lexoffice-final-invoice` → `create-event-quotation` (jetzt mit gefixtem per_event-Branch).
   Ergebnis-PDF zeigt dann **9 Positionen mit korrekter Menge × Einzelpreis = Gesamt**.

3. **Sanity-Check via `lex-inspect`** (optional, automatisch nach Schritt 2):
   - `quantity = 3`, `unitPrice.grossAmount = 52` für Vitello
   - Brutto-Gesamtsumme = **1.135,50 €** (= `total_amount` in Maestro, unverändert)

## Technische Details

- **Keine Migration nötig** — DB-Daten sind korrekt.
- **Kein neuer Code nötig** — Fix steckt in `supabase/functions/create-event-quotation/index.ts` ab Commit `dcd3f313` (heute 23:54).
- **Anzahlungsrechnungen** (`create-lexoffice-downpayment-invoice`) bleiben bewusst bei `quantity: 1, unitName: "Pauschale"` — Anzahlung ist ein einzelner Brutto-Betrag, nicht aufgegliedert (steuerlich korrekt nach § 14 Abs. 5 UStG).
- Sollten weitere Schlussrechnungen aus dem Zeitfenster **vor 23:54** existieren, gilt für die exakt dasselbe Vorgehen (Stornieren → Neu erzeugen).
