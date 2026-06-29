## Ziel

Im Admin sollen alle Listen per Drag & Drop sortierbar sein:

- `/admin/menu` — Catering: Kategorien untereinander sortieren + Speisen innerhalb einer Kategorie sortieren
- `/admin/menu` — Ristorante: gleiche Logik (Kategorien + Items)
- `/admin/packages` — Pakete-Reihenfolge + Locations-Reihenfolge

Die Reihenfolge wird in der bereits existierenden Spalte `sort_order` persistiert (vorhanden auf `menu_categories`, `menu_items`, `packages`, `locations`). Sie wirkt damit automatisch auch im Frontend (Speisekarte, Event-Pakete), das nach `sort_order` sortiert lädt.

## Umsetzung

### 1. Library
`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` sind bereits im Projekt (verwendet in `QuoteBuilder.tsx`) — keine neue Dependency.

### 2. Neue Wiederverwendbare Komponente
`src/components/admin/shared/SortableList.tsx` — dünner Wrapper um `DndContext` + `SortableContext` (vertical strategy), mit:
- Drag-Handle (GripVertical-Icon links)
- Optimistic Reorder im lokalen State
- onReorder-Callback liefert neue Reihenfolge der IDs

### 3. Menü-Liste (`MenuItemsList.tsx`)
- Kategorien-Ebene: `CategorySection`-Karten in eine `SortableList` packen (Handle im Header, links neben dem Chevron).
- Item-Ebene: Items innerhalb der `CollapsibleContent` einer Kategorie in eine `SortableList` packen (Handle ganz links pro Zeile).
- Bei Drop: bulk-Update von `sort_order` per `supabase.from('menu_categories' | 'menu_items').upsert([{id, sort_order}, …])`.
- React-Query invalidieren (`useCateringMenus`, `useRistoranteMenus`).

### 4. Ristorante-Tab
Gleiche Behandlung im `RistoranteTab` (analoge Struktur, Items via `menu_items`-Tabelle).

### 5. Pakete & Locations (`PackagesList.tsx`)
- Paket-Karten-Grid wird zur sortierbaren Liste. Damit Drag in einem 3-spaltigen Grid funktioniert, nutzen wir `rectSortingStrategy` statt vertical. Handle = kleines GripVertical-Badge oben links auf der Karte.
- Locations-Grid analog.
- Update `sort_order` auf `packages` bzw. `locations` per upsert, Refine `useList` refetchen.

### 6. Persistenz-Helper
Eine kleine Util `persistSortOrder(table, orderedIds)` die ein `upsert` mit `{ id, sort_order: index }` macht und Fehler toastet.

### Technisches

```text
SortableList<T>
  ├── DndContext (PointerSensor, distance:8)
  └── SortableContext(items=ids, strategy)
        └── SortableItem (useSortable) — rendert children + Handle via renderProp
```

- Keine Schema-Änderungen nötig.
- Filter/Suche aktiv → Drag wird deaktiviert (Reordering nur bei voller Liste sinnvoll), Hinweis-Toast falls versucht.
- Bestehende Frontend-Queries sortieren bereits nach `sort_order` — Änderungen wirken sofort live.

### Nicht im Scope

- Sortierung der Top-Level-Tabs (Catering/Ristorante/Archiv/Papierkorb).
- Sortierung innerhalb Archiv/Papierkorb.
- Drag zwischen Kategorien (Items in andere Kategorie verschieben) — kann später nachgezogen werden, falls gewünscht.
