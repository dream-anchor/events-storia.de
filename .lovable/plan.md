Ich werde die bestehende `/admin/events`-Kanban-Ansicht korrigieren, weil genau diese Ansicht im Screenshot aktiv ist.

Plan:
1. In `src/types/refine.ts` das EventInquiry-Model um die bereits vorhandenen View-Felder erweitern, die für die Art-Erkennung nötig sind (`inquiry_type`, `location_type`, ggf. `source`).
2. In `src/components/admin/refine/KanbanView.tsx` ein kleines, lokales Service-Badge ergänzen und direkt oben auf jeder Kanban-Karte anzeigen.
3. Die Label-Logik so setzen:
   - `source === reisegruppen` oder Gruppe-Erkennung → `Reisegruppe`
   - `inquiry_type === catering` oder externe Location → `Catering`
   - sonst → `In Haus`
4. Optional denselben Badge auch in der Tabellenansicht von `EventsList.tsx` ergänzen, damit Tabelle und Kanban konsistent sind.

Technische Details:
- Keine Datenbankänderung nötig.
- Keine neue Ansicht.
- Die bestehende `/admin/events`-Ansicht bleibt erhalten; es wird nur die fehlende Anzeige auf den Karten ergänzt.