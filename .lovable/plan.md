## Ziel
Kategorien und Speisen sollen in `/admin/menu` wieder zuverlässig per Drag-&-Drop verschiebbar sein — ohne erneutes Herumprobieren nur an Sensoren.

## Geplanter Fix
1. **Drag-Handle reparieren**
   - In `SortableList.tsx` die Listener nicht mehr durch `stopPropagation` auf `pointer/mouse down` blockieren.
   - Der Drag-Handle bleibt optisch gleich, aber das Drag-Event erreicht `@dnd-kit` wieder zuverlässig.
   - Zusätzlich nutze ich einen stabilen `PointerSensor` mit klarer Aktivierungsdistanz, statt Mischzuständen aus mehreren Sensoren.

2. **Nested Drag-Konflikte vermeiden**
   - Kategorien und Speisen verwenden aktuell verschachtelte `SortableList`-Kontexte.
   - Ich trenne das Verhalten so, dass Drag für Kategorien nur am Kategorie-Griff startet und Drag für Speisen nur am Speisen-Griff.
   - Der Collapsible-Header bleibt klickbar zum Öffnen/Schließen, ohne den Drag-Start zu verschlucken.

3. **Persistenz robuster machen**
   - `persistSortOrder` bleibt die zentrale Speicherfunktion.
   - Nach erfolgreichem Speichern werden weiterhin die Menü-Daten neu geladen.
   - Falls Speichern fehlschlägt, bleibt die Fehlermeldung auf Deutsch.

4. **Gezielte Validierung**
   - Ich prüfe nach der Änderung im Browser, ob der Griff (`aria-label="Verschieben"`) sichtbar und bedienbar ist.
   - Wenn möglich teste ich eine tatsächliche Drag-Bewegung für Kategorie und Speise im Admin-Menü.

## Nicht enthalten
- Kein neues Design.
- Keine neue Sortierfunktionalität.
- Keine Änderungen am Freitext-Import oder Angebotssystem.
- Keine Datenbankmigration.