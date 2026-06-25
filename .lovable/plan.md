## Plan: Freitext-Import berechnet Preise automatisch

1. **Kalkulationsbasis aus importierten Zeilen ableiten**
   - Für Mahlzeiten: `pricePerPersonNet × guestCount` plus `flatPriceNet`.
   - Für Zusatzleistungen: `unitPriceNet × Menge`; falls Menge fehlt, bleiben diese bewusst nicht im Gesamtbetrag, weil im Text „bei Bedarf“ steht.
   - Pauschalen wie Anfahrt/Abfahrt können bei Menge leer als nicht eingerechnet bleiben, damit „bei Bedarf“ nicht automatisch verrechnet wird.

2. **Import-Fallback ergänzen**
   - Wenn der Text „99,00 € pro Person“ und die Anfrage/Option 20 Gäste hat, soll der Import `foodNet = 99 × 20 = 1.980` setzen.
   - Daraus `foodVatAmount` und `totalsFromText.gross` berechnen.
   - Wenn kein Gesamtbetrag im Text steht, wird der Gesamtbetrag aus den importierten Maestro-Zeilen gebildet, nicht aus KI-Schätzung.

3. **Editor live synchronisieren**
   - Wenn der Nutzer im Freitext-Editor Gäste, Preis pro Person, Pauschalpreis, MwSt oder Service-Mengen ändert, aktualisieren sich Speisen netto, MwSt, Gesamt netto und Gesamt brutto sofort.
   - Manuelle Eingaben in den Summen bleiben weiterhin möglich, aber die Zeilenpreise dürfen nicht mehr sichtbar 0 ergeben, wenn Preis × Personen vorhanden ist.

4. **Speichern/Public Offer absichern**
   - `totalAmount` der Angebotsoption übernimmt den berechneten Brutto-Gesamtbetrag aus `freeformProgram.totalsFromText.gross`, damit Zahlungs-/Angebotsansicht nicht 0 bleibt.

5. **Validierung**
   - Test mit dem konkreten David-Text: 20 Personen × 99 €/Person → Speisen netto 1.980,00 €, +7% MwSt 138,60 €, Gesamt brutto 2.118,60 €.
   - Zusatzleistungen werden erkannt, aber nur eingerechnet, wenn eine Menge gesetzt ist.