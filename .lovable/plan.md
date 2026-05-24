## Befund

- Die Datenbank ist erreichbar und enthält Bestellungen: aktuell 33 Catering-Bestellungen, davon 2 Testbestellungen.
- Der Grund, warum Kanban und Tabelle leer wirken: Die aktuelle Bestellungen-Ansicht filtert standardmäßig auf `pending` und `confirmed` (`Eingang`). In der Datenbank gibt es aber momentan keine Bestellungen mit diesen Statuswerten; alle vorhandenen Bestellungen sind `completed` oder `cancelled`.
- Die neuen bezahlten Testbestellungen wurden offenbar sofort als `completed` gespeichert/angezeigt. Dadurch landen sie nicht im Standard-Filter „Eingang“.
- Zusätzlich ist die neue `OrdersKanbanView` farblich/technisch noch nicht sauber an das bestehende Premium-Light-Design angepasst und nutzt direkte Farbklassen.

## Ziel

Bestellungen sollen in Maestro zuverlässig sichtbar sein, besonders neue/bezahlte Catering-Bestellungen, ohne die getrennte Navigation wieder rückgängig zu machen.

## Umsetzung

1. **Standardansicht korrigieren**
   - In `OrdersList.tsx` den Default-Filter von `Eingang` auf eine sinnvollere Bestellungsansicht ändern.
   - Vorschlag: Default `Alle`, damit keine bezahlte Bestellung durch Status-Mapping unsichtbar wird.
   - Alternativ könnte `Eingang` auch `completed` einschließen, aber das wäre fachlich unsauber, weil „Erledigt“ dann doppelt auftaucht.

2. **Filter-Beschriftung für Bestellungen schärfen**
   - Die Status-Pills so benennen, dass sie zum Bestellprozess passen:
     - `Alle`
     - `Neu / offen`
     - `Bestätigt`
     - `Erledigt`
     - `Storniert`
   - Dabei keine Datenlogik im Backend ändern.

3. **Kanban leer-Zustand verbessern**
   - Wenn Kanban keine Karten in den Spalten zeigt, aber Daten vorhanden sind, soll klarer erkennbar sein, welcher Filter/Status greift.
   - Kanban soll weiterhin einen eigenen unlimitierten Status-Query nutzen und alle Orders anzeigen.

4. **Order-Status-Mapping prüfen, aber nicht automatisch ändern**
   - Ich ändere nicht blind die Datenbank-Trigger, weil `completed` evtl. bewusst durch alte Automatisierung gesetzt wurde.
   - Ich prüfe im Code, ob der Checkout oder Reminder-Cron neue bezahlte Orders direkt auf `completed` setzt.
   - Falls ja, schlage ich danach separat vor: bezahlt = `confirmed`, erst nach Lieferzeit = `completed`.

5. **Design-Konformität der neuen Kanban-Ansicht korrigieren**
   - Direkte Grün/Gelb-Farbklassen in `OrdersKanbanView.tsx` entfernen oder auf bestehende semantische Tokens/zulässige neutrale Akzente umstellen.
   - Premium-Light-Monochrome-Standard beibehalten.

## Validierung

- Read-only Datenbankcheck: Bestellungen existieren und werden nicht durch fehlende Daten verursacht.
- Frontend-Check: `/admin/orders` zeigt nach Änderung die vorhandenen Bestellungen direkt in Tabelle und Kanban.
- Keine Änderung an Checkout, Zahlungslogik oder Datenbankstruktur ohne separaten Befund.