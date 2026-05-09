## Karten-Titel + Archivieren im Kanban

### 1. Karten-Titel: nie „Private/privat"

**Problem:** Im Kanban (und potentiell anderswo) erscheint „Private" oder „privat" als Karten-Titel, obwohl das nur ein Platzhalter für „keine Firma" ist.

**Fix in `KanbanView.tsx` `KanbanCard`:**

```ts
const rawCompany = event.company_name?.trim() ?? "";
const isPlaceholder = /^(private|privat)$/i.test(rawCompany);
const title =
  (!isPlaceholder && rawCompany) ||
  event.contact_name?.trim() ||
  "Unbenannte Anfrage";
```

So zeigt die Karte bei `company_name = "Private"` automatisch den `contact_name` (z. B. „Jonathan Starke" statt „Private"). Falls beides leer ist → „Unbenannte Anfrage".

Scope bewusst klein: nur die Kanban-Karte. Tabelle und andere Stellen bleiben unverändert; falls dort auch erwünscht, in Folge-Iteration.

### 2. Archivieren im Kanban

**UX:** Hover-Action oben rechts auf jeder Karte. Klein, unauffällig im Ruhezustand, sichtbar bei Hover. Identische Server-Logik wie Bulk-Archiv (`archived_at = now()`, `archived_by = user.email`).

```text
┌─────────────────────────────────────┐
│ 🔴 Martin Uhlig            13.05.26 [📦] │  ← Archiv-Icon erscheint bei Hover
│    20 Gäste · 2.400 €      AM · 2d  │
└─────────────────────────────────────┘
```

- Icon: `Archive` aus `lucide-react`, 14 px, `text-slate-400 hover:text-slate-700`
- Position: absolut top-right der Karte (überlagert nicht das Datum, da Datum links davon bleibt — wir verschieben das Datum ggf. nicht, sondern legen den Icon-Button via `opacity-0 group-hover:opacity-100` darüber in einer eigenen Zeile-Ecke)
- `onClick`: `e.stopPropagation()` (sonst würde Card-Click zur Detail-Seite navigieren), dann Update + Toast + `onRefresh()`
- Confirm-Dialog: nicht nötig (Archiv ist reversibel — Wiederherstellen-Aktion existiert in der Tabelle im „Archiv"-Tab)
- Drag-Handler: Icon-Button bekommt `draggable={false}` und `onMouseDown` stoppt Propagation, damit der Karten-Drag nicht startet

**Implementierung:**

In `KanbanView.tsx`:
- Neuer Handler `handleArchiveCard(eventId)` — analog zum BulkArchive
- `KanbanCard`-Props erweitern um `onArchive`
- Icon-Button in der Karte ergänzen (mit `group-hover:opacity-100`-Pattern, das der Container bereits über `group` haben muss)

**Geänderte Datei:** ausschließlich `src/components/admin/refine/KanbanView.tsx`. Keine DB-Änderung, kein neuer Helper.

### Smoke-Test
1. „Jonathan Starke" / „Private" wird im Kanban als „Jonathan Starke" angezeigt
2. „privat" (Lukas Russo) wird als „Lukas Russo" angezeigt
3. Hover über Karte → Archiv-Icon erscheint top-right
4. Klick auf Icon → Karte verschwindet, Toast „Anfrage archiviert", Karte taucht im Tabellen-Tab „Archiv" auf
5. Klick auf Icon löst NICHT die Navigation zur Detail-Seite aus
6. Drag-Start startet nicht beim Klick auf das Archiv-Icon
