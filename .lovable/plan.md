## Plan

Reisegruppen sollen in „Anfragen“ nicht mehr als rechtes Sheet/Overlay erscheinen. Beim Klick sollen sie wie „Im Haus“ als eigene Detailseite im Admin-Bereich geöffnet werden.

## Umsetzung

1. **Kein Sheet mehr aus der Anfragen-Übersicht**
   - `UnifiedInquiriesList.tsx` rendert für Reisegruppen kein `<GroupInquiryDetail />` mehr innerhalb der Übersicht.
   - Dadurch verschwindet die dunkle Overlay-Ansicht mit rechter Drittel-Spalte.

2. **Reisegruppen per Navigation öffnen**
   - Klick auf eine Reisegruppe führt künftig auf eine normale Admin-Detailroute, z. B. `/admin/reisegruppen/:id/edit`.
   - Das gilt für Kanban, Tabelle und Mobile Cards.

3. **Neue Vollseiten-Detailansicht für Reisegruppen**
   - Die bestehende Reisegruppen-Detailmaske wird aus dem Sheet herausgelöst und als normale Seite aufgebaut.
   - Layout-Verhalten wie bei „Im Haus“: volle Admin-Seite mit Zurück-Button, Header, Datenbereichen und Speichern unten inline.
   - Status, interne Notizen, Kontaktdaten, Wunschdatum, Gruppengröße, Wunschmenü, Nachricht und Reiseplan bleiben erhalten.

4. **Alte Reisegruppen-Liste entschärfen**
   - Die alte Route `/admin/reisegruppen` bleibt erreichbar, wird aber nicht mehr aus „Anfragen“ geöffnet.
   - Optional bleibt dort das alte Sheet-Verhalten für Direktnutzung bestehen, aber nicht mehr im Hauptworkflow.

## Technische Details

- Frontend-only Änderung, keine Datenbankänderung.
- Betroffene Dateien:
  - `src/pages/RefineAdmin.tsx` für die neue Route
  - `src/components/admin/refine/UnifiedInquiriesList.tsx` für Navigation statt Sheet
  - `src/components/admin/refine/UnifiedKanbanView.tsx` für Navigation statt Callback/Sheet
  - `src/components/admin/refine/GroupInquiriesList.tsx` oder neue kleine Detail-Komponente für die Vollseitenansicht

## Ergebnis

Reisegruppen verhalten sich in der Anfragen-Liste wie „Im Haus“: Klick öffnet eine normale Detailseite statt einer rechten Overlay-Anzeige.