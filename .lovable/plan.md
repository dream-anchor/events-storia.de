# Anfragenübersicht wieder laden

## Ziel
Die vorhandenen Event-Anfragen sollen in Tabelle und Kanban wieder sichtbar sein.

## Umsetzung
- Den Testdatenfilter so korrigieren, dass echte ältere Datensätze mit leerem `is_test`-Wert nicht versehentlich ausgeschlossen werden.
- Dieselbe Filterregel für Liste, Suche, Zähler und zugehörige Buchungen verwenden.
- Die Anfragenansicht anschließend im angemeldeten Zustand prüfen.

## Technische Details
Aktuell wird mit `is_test != true` gefiltert. Datenbankseitig schließt das auch Datensätze mit `NULL` aus. Korrekt ist: `is_test IS NULL OR is_test = false`.
