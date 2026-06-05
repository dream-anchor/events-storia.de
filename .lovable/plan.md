Ich werde den Public-Offer-/Preview-Flow gezielt korrigieren:

1. **„Private“ zuverlässig ersetzen**
   - Die aktive Public-Offer-Seite nutzt `src/pages/PublicOffer.tsx`, nicht nur die neuere Komponente `src/pages/public-offer/HeroSection.tsx`.
   - Dort wird `company_name = "Private"` aktuell noch als echter Name angezeigt.
   - Ich passe die Anzeige so an, dass `Private`/leere Firma als Platzhalter gilt und stattdessen immer `contact_name` angezeigt wird, z. B. „Herr Starke“.

2. **Beträge nie auf volle Euro kürzen**
   - In der alten aktiven Public-Offer-Seite gibt es noch Stellen, die Beträge ohne Nachkommastellen formatieren.
   - Ich ändere alle kundenrelevanten Gesamt-/Zahlungsbeträge dort auf deutsche Euro-Formatierung mit **immer genau 2 Nachkommastellen**.
   - Beispiel: `1.053,99 €` bleibt `1.053,99 €`, nicht `1.054 €`.
   - Anzahlungen werden ebenfalls aus der Originalsumme berechnet und mit 2 Nachkommastellen angezeigt.

3. **Final Offer Rundungsfehler entfernen**
   - In `FinalOfferView.tsx` ist die Anzahlung noch fehlerhaft berechnet: `Math.round(totalAmount * depositPercent) / 100`.
   - Das kann falsche Cent-Beträge erzeugen.
   - Ich ersetze das durch `(totalAmount * depositPercent) / 100`, damit Maestro-Werte nicht verändert werden.

4. **„Reload“/Preview-Hinweis entfernen**
   - In der Public-Offer-Seite existiert ein Reload-/Neu-laden-UI bei Fehlerzuständen bzw. Vorschauzuständen.
   - Ich entferne/ersetze die sichtbare Reload-Aufforderung im Kunden-/Preview-Kontext, damit kein „Reload“ mehr im Angebot steht.
   - Stattdessen wird neutral geladen oder die aktuelle Ansicht bleibt ohne kundenirritierende Aufforderung.

5. **Preview-Klick bleibt Sync-Auslöser**
   - Der bestehende Klick auf „Vorschau anzeigen“ bleibt der Trigger, der Public Offer und LexOffice aktualisiert.
   - Ich ändere nur die Anzeige-/Berechnungsfehler, keine neue Logik für Preise und keine Neuberechnung außerhalb der vorhandenen Maestro-Datenquelle.

Technisch betroffene Dateien voraussichtlich:
- `src/pages/PublicOffer.tsx`
- `src/pages/public-offer/FinalOfferView.tsx`

Keine Datenbankmigration erforderlich.