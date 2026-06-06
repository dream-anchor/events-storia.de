Ich werde den Fix an einer Stelle machen: `supabase/functions/create-event-quotation/index.ts`.

Plan:

1. **Reuse-Logik korrigieren**
   - Der aktuelle Code verwendet ein vorhandenes LexOffice-Angebot weiter, wenn Gesamtbetrag und Zahlungstext gleich sind.
   - Genau deshalb sieht man „keine Änderung“: Das alte PDF wird wiederverwendet, obwohl die Preis-/Steuerlogik im Code geändert wurde.
   - Ich ändere den Freshness-Check so, dass alte Belege mit falscher Steuerdarstellung nicht mehr reused werden.

2. **Alte LexOffice-Angebote zuverlässig als stale markieren**
   - Zusätzlich zu Gesamtbetrag und Zahlungstext wird geprüft:
     - `taxConditions.taxType` muss `net` sein.
     - Positionen müssen zur aktuellen Netto-Logik passen.
     - Alte rabattierte/skalierte Positionen ohne separate Rabattzeile dürfen nicht wiederverwendet werden.
   - Wenn das nicht passt, wird das alte Draft/Open-Angebot gelöscht und ein neues erzeugt.

3. **Payload unverändert auf deutschen Rechnungsstandard halten**
   - LexOffice bekommt weiterhin `taxType: 'net'`.
   - Maestro bleibt die Quelle für Brutto-Endpreise.
   - Für LexOffice werden daraus Netto-Positionspreise berechnet.
   - Unten im Beleg stehen dann Netto-Zwischensumme, MwSt. je Satz und Brutto-Gesamtbetrag.

4. **Deploy der Function**
   - Danach deploye ich `create-event-quotation`, damit neue Klicks im Admin sofort frische PDFs erzeugen.

Erwartetes Ergebnis:
- Das nächste neu generierte Angebot wird nicht mehr das alte PDF wiederverwenden.
- Die Positionen erscheinen im Netto-Standard.
- Unten weist LexOffice Netto, MwSt. und Brutto sauber aus.