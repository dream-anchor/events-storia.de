## Plan

1. **Zentrale LexOffice-Positionslogik härten**
   - In `create-event-quotation` die Getränkelogik so erweitern, dass Getränke aus allen vorhandenen Strukturen übernommen werden:
     - `menu_selection.drinks` (Paket-/Legacy-Getränke wie Wasser, Hauptgetränk, Espresso)
     - `drinksMode = pauschale | weinbegleitung | einzeln`
     - `drinksEinzeln`, `drinksPauschaleDescription`, `winePairingPrice`
   - Getränke werden immer mindestens in der Beschreibung der LexOffice-Position aufgeführt; bezahlte Getränkepositionen zusätzlich als 19%-Position, wo Preis vorhanden ist.

2. **Summen-Sicherheit einbauen**
   - Nach dem Bauen der LexOffice-LineItems wird die Summe gegen `total_amount` geprüft.
   - Wenn LineItems Getränke/Speisen in der Beschreibung enthalten, aber die Summe durch Rundung/fehlende Teilpreise nicht exakt passt, wird automatisch eine dezente Ausgleichsposition ergänzt oder die Hauptposition so korrigiert, dass LexOffice exakt den Angebotspreis übernimmt.
   - Kein Aufrunden: weiterhin exakt auf 2 Nachkommastellen.

3. **Varianten und gewählte Mengen abdecken**
   - Der Fix gilt für normale Angebote, Multi-Option-Angebote, Alternativpositionen und Rechnungen nach Kundenauswahl (`useSelectedQuantity`).
   - Bei `guestOverride` wird die effektive Personenanzahl auch für Getränkepositionen verwendet.

4. **Alte Reparaturfunktion angleichen**
   - `repair-quotation-pricing` bekommt dieselbe Getränkelogik, damit man bestehende fehlerhafte LexOffice-Angebote konsistent neu erzeugen kann.

5. **Betroffene Anfrage neu generierbar machen**
   - Für die aktuell betroffene Anfrage wird die stale LexOffice-Quotation-ID zurückgesetzt, damit beim nächsten PDF/Preview ein neues Dokument mit Getränken erzeugt wird.

## Technische Details

- Hauptdateien: `supabase/functions/create-event-quotation/index.ts`, `supabase/functions/repair-quotation-pricing/index.ts`.
- Kein UI-Redesign, keine Änderung an öffentlichen Angebotsseiten.
- Die bestehende Freshness-Prüfung bleibt erhalten, wird aber durch die vollständigere Positionssumme zuverlässiger.