## Diagnose: Getränke fehlen weiterhin im LexOffice-Beleg

DB-Stand für die Anfrage `90321866-…ce97`:
- `offer_mode = full_menu`, `pricingMode = per_person`, `drinksMode = einzeln`
- `budgetPerPerson = 40,20 €`, `guest_count = 74`, `total_amount = 2.974,80 €`
- `drinksEinzeln = [{Wasser…, pricePerPerson: 0}, {Zwei Getränke pro Person…, pricePerPerson: 0}]`

In `create-event-quotation` läuft dieser Fall in den **Paket-/E-Mail-Branch** (Zeile 483 ff.), weil der `menu`-Branch nur auf `offer_mode === 'menu'` matcht — `full_menu` matcht dort nicht. Der Paket-Branch baut **eine** Position `Veranstaltungspaket` mit `quantity = 74 Person × 40,20 € (7 %)` und listet Inhalte in `description`.

Die Speisen werden korrekt in die Beschreibung übernommen, die Getränke aber **nicht**, weil `buildDrinkInfoLines()` in Zeile 128 alle Getränke mit `pricePerPerson <= 0` herausfiltert. Genau das sind die zwei Inklusivgetränke des Kunden → sie verschwinden komplett aus dem LexOffice-Dokument.

Dasselbe Filter-Muster steht in `repair-quotation-pricing/index.ts` (Zeile 317).

## Fix

### 1) `supabase/functions/create-event-quotation/index.ts`
- `buildDrinkInfoLines()` so anpassen, dass **inklusive** Getränke (`pricePerPerson === 0` oder undefined) immer in der Beschreibung gelistet werden. Nur leere Namen werden übersprungen. Der Preis-Filter (`<= 0`) entfällt für die reine Description-Ausgabe.
- Wenn ein Preis > 0 vorhanden ist, weiterhin als „Name (X,XX €/Pers.)" formatieren; bei Preis 0 nur den Namen ausgeben (z. B. „Zwei Getränke pro Person (Wahl zwischen Wein, Spritz oder Bier) — inklusive").
- Analog für `drinksMode = pauschale` und `weinbegleitung`: Wenn Preis 0 ist (selten, aber möglich), trotzdem mit Hinweis „inklusive" listen.

### 2) `supabase/functions/repair-quotation-pricing/index.ts`
- Dieselbe Änderung in der dortigen `buildDrinkInfoLines`-Funktion (Zeile 315 ff.).

### 3) Stale Quotation zurücksetzen
- `UPDATE event_inquiries SET lexoffice_quotation_id = NULL WHERE id = '90321866-239d-4331-a85b-fddf5280ce97'` per neuer Migration, damit beim nächsten Preview/Versand ein frisches LexOffice-Dokument mit korrekter Beschreibung entsteht.

### 4) Deploy & Verifizieren
- Edge Functions `create-event-quotation` und `repair-quotation-pricing` deployen.
- Dry-Run via `OfferSendPreview` (Route bereits offen): geladenes PDF muss in der Position „Veranstaltungspaket" jetzt unter „Inklusive:" auch beide Getränke nennen.

## Was NICHT geändert wird
- Keine Tax-Logik-Änderung (7 % bleibt korrekt für inkludiertes Komplettpaket — sobald Getränke einen Eigenpreis bekommen, greifen die bestehenden 19 %-Positionen weiter unten im Code).
- Kein Refactoring der `full_menu` vs. `menu` Branch-Unterscheidung — separates Thema, würde den Scope sprengen.
