## Ziel
1. **Neue Projekt-Regel** in `mem://` speichern: Alle Kunden-Mails müssen zweisprachig sein – Deutsch oben, sichtbarer Trenner, Englisch darunter.
2. **Beide Vorschau-Mails** zweisprachig machen:
   - `vorschau-rigshospitalet-restzahlung.html` (Christina Byrne Windfeld)
   - `vorschau-cyim-bestaetigung.html` (Jessica Lagourrès)
3. **Bei Christina** zusätzlich den fehlenden Satz ergänzen:
   > „Ihre Anzahlung in Höhe von 490,00 € ist bei uns eingegangen und wurde erfolgreich verbucht."

## Vorgehen
1. Memory-Datei `mem://communications/bilingual-customer-emails` anlegen + Index aktualisieren (Core-Regel).
2. Englische Übersetzungen einmalig mit Lovable AI (gpt-5.4) erzeugen – hochwertig, geschäftsmäßig, britisches Englisch.
3. Trenner-Design: dezente horizontale Linie + Label „English version" (gleiche Brand-Farbe `#b45309`).
4. Reihenfolge: kompletter deutscher Block (inkl. Anrede, Stornobedingungen, Footer-Hinweise) → Trenner → kompletter englischer Block. Buchungstabellen werden **einmal** gezeigt (Zahlen sind sprachneutral) – Labels bleiben deutsch, englische Übersetzung der Spalten kommt in Klammern oder als zweite Tabelle im EN-Block (zweite Tabelle, sauberer).
5. Footer (Speranza GmbH …) bleibt einmalig am Ende (rechtlich identisch).
6. Bei Christina den Anzahlungs-Satz in beiden Sprachen direkt nach der Anrede einbauen.

## Output
Beide aktualisierte HTML-Dateien als `<presentation-artifact>` zur Vorschau.