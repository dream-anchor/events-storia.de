## Problem
Nach dem letzten Umbau lassen sich weder Kategorien noch Speisen per Drag verschieben. Das Grip-Icon ist sichtbar, reagiert aber nicht. Aus Statik allein nicht eindeutig erkennbar, ob (a) PointerDown gar nicht ankommt, (b) `onDragEnd` läuft aber Persistenz schlägt fehl, oder (c) die `ids`-Array-Identität die `SortableContext`-Tracker zurücksetzt.

## Vorgehen

### 1. Diagnose im laufenden Admin (Playwright, headless)
- `/admin/menu` öffnen, Catering-Tab.
- Console-Listener + Drag-Simulation per `mouse.down/move/up` auf ein Grip-Icon (Kategorie + Speise).
- Loggen: `pointerdown`-Events auf dem Handle, `dnd-kit` Warnungen, `persistSortOrder`-Errors, Netzwerk-Update auf `menu_categories` / `menu_items`.
- Screenshot vor/nach Drag.

### 2. Fix anhand der Diagnose – wahrscheinlichste Ursachen und Maßnahmen

a) **`ids`-Array neu pro Render** → `SortableContext` verliert Tracking.
   - In `MenuItemsList.tsx` die `ids`-Arrays via `useMemo` stabilisieren (Kategorien je Menü, Items je Kategorie).

b) **`PointerSensor`-Aktivierung blockiert durch `touch-action`/Overlay.**
   - In `SortableList.tsx`: am Handle bereits `touch-none` — zusätzlich am `setNodeRef`-Container `style.touchAction = "manipulation"` setzen und die `activationConstraint` von `{distance: 6}` auf `{distance: 4}` reduzieren.

c) **Verschachtelte `DndContext` (Kategorie-Liste enthält Item-Liste) fängt PointerDown der äußeren ab.**
   - Outer SortableList und inner SortableList behalten — aber äußere Sensoren mit `{distance: 8}`, innere mit `{distance: 4}`, damit Events sauber getrennt aktivieren.
   - Falls die Playwright-Diagnose zeigt, dass die innere `DndContext` das äußere `pointerdown` schluckt: am inneren `DndContext`-Wrapper-Div `onPointerDown` nur dann an dnd-kit weiterreichen, wenn das Ziel innerhalb des Item-Bereichs liegt (Wrapper-Div mit Ref + Target-Check). Praktisch: SortableList akzeptiert optionales `scopeRef` und delegiert.

d) **Persistenz schlägt still fehl** (z. B. RLS-Update auf `menu_categories.sort_order`).
   - Bestätigung über Netzwerk-Tab. Falls 401/403: `persistSortOrder` Fehler bereits `toast`-en — zusätzlich `console.error` mit Tabelle + IDs ergänzen, damit der Toast „Reihenfolge konnte nicht gespeichert werden" eindeutig zuzuordnen ist.

### 3. Verifikation
- Playwright-Replay: Kategorie 1 → Position 3, Reload, Reihenfolge persistent.
- Speise innerhalb Kategorie verschoben, Reload, Reihenfolge persistent.
- Collapse/Expand per Header-Klick weiter funktionsfähig.
- Edit/Archiv/Delete-Buttons unverändert.
- Pakete- und Locations-Sortierung (gleiches `SortableList`) unverändert.

## Betroffene Dateien (voraussichtlich)
- `src/components/admin/shared/SortableList.tsx` (Sensor-Constraints, optional Scope-Ref, `touchAction`)
- `src/components/admin/refine/MenuItemsList.tsx` (memoisierte `ids`-Arrays)

Keine Schema-/Migrations-Änderungen, keine UI-Restrukturierung über das hinaus, was die Diagnose erfordert.
