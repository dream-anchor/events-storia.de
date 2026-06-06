## Plan

1. **Event-Rechnungen/Angebote in `create-event-quotation` auf Netto-Logik umstellen**
   - `LexOfficeLineItem` so erweitern, dass die Funktion wahlweise `grossAmount` oder `netAmount` senden kann.
   - Die Maestro-Preise bleiben weiterhin die fachliche Quelle, werden für LexOffice aber technisch von Brutto in Netto umgerechnet, damit LexOffice unten den **Gesamtbetrag netto** und die **MwSt. je Steuersatz** ausweist.
   - Rabatt- und Anzahlungsabzugszeilen werden ebenfalls korrekt netto berechnet, mit gleichem Steuersatz wie die betroffene Position.

2. **LexOffice-Payload auf Standard-Rechnungsdarstellung setzen**
   - `taxConditions.taxType` von `gross` auf `net` ändern.
   - Alle `unitPrice.grossAmount`-Werte vor dem API-Call in `unitPrice.netAmount` umwandeln: `net = brutto / (1 + taxRate / 100)`.
   - Dadurch zeigt LexOffice in der Positionsliste Nettopreise und unten die MwSt.-Aufschlüsselung – Standard für deutsche Rechnungen.

3. **Summen-Konsistenz sicherstellen**
   - Vor dem Senden prüfen, dass die aus Netto + MwSt. resultierende Brutto-Gesamtsumme weiterhin exakt dem Maestro-Gesamtbetrag entspricht.
   - Kleine Cent-Differenzen werden auf die letzte Position mit passendem Steuersatz korrigiert, damit LexOffice und Maestro nicht auseinanderlaufen.

4. **Bestehende Catering-Shop-Rechnungen prüfen**
   - `create-lexoffice-invoice` nutzt bereits `taxType: 'net'` und `netAmount`; dort ist voraussichtlich keine Änderung nötig.

## Ergebnis

LexOffice wird die Einzelpositionen netto anzeigen, unten den Nettogesamtbetrag ausweisen und darunter die MwSt. nach 7 % / 19 % sowie den Bruttogesamtbetrag darstellen – wie bei deutschen Standardrechnungen üblich.