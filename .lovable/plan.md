## 1. Neue Anfragen: rot statt orange + immer ganz oben

### Root Cause
In `src/lib/inquiryActionState.ts` (Zeile 47) bekommt `status === "new"` nur dann den Zustand `respond` (rot), wenn die Anfrage **älter als 24 h** ist. In den ersten 24 h fällt sie in den Default-Bucket `in_progress` (orange). Das erklärt:

- **Farbe orange** statt rot bei der frisch eingegangenen Flavia-Anfrage.
- **Position weiter unten**: In `KanbanView.tsx` (Zeile 118) sortiert die Spalte zuerst nach `ActionState` (`respond=0` vor `in_progress=1`), dann nach Zeit. Eine frische „Neu"-Anfrage in `in_progress` landet unter allen `respond`-Karten.

### Fix

**a) `src/lib/inquiryActionState.ts`**
- Den Block für „> 24 h" entfernen. Stattdessen: **jede Anfrage mit `status === "new"` (und nicht archiviert) ist immer `respond` / rot** mit Label „Neu".
- Damit ist der bisherige `in_progress`-Default für `status === "new"` (Zeilen 103–104) tot — entfernen, falls leer; übrige In-Progress-Labels bleiben (`offer_sent`, `contacted`).

**b) Sortierung — keine Änderung nötig**
- `KanbanView.tsx` sortiert innerhalb desselben States bereits nach `updated_at || created_at` **descending** (Zeile 124–126). Sobald alle „Neu" im `respond`-Bucket sind, landet die jüngste automatisch oben.

**c) `src/components/admin/refine/EventsList.tsx` (Liste)**
- Aktueller Default-Sort: `preferred_date asc` (Eventdatum, Zeilen 119 und 591). Damit erscheinen frische Anfragen mit weit entferntem Eventdatum mittig/unten.
- Default-Sort umstellen auf `created_at desc` → neueste Anfragen ganz oben. Anwender kann weiterhin per Spaltenklick anders sortieren.
- Anpassung an beiden Stellen: `sorters: [{ field: "created_at", order: "desc" }]` und `defaultSorting={[{ id: "created_at", desc: true }]}`.

---

## 2. Mailprogramm: Sortierung neu → alt

### Fix
- `src/components/admin/shared/MailClient.tsx`: Sidebar-Liste in **umgekehrter Reihenfolge** rendern (`[...items].reverse().map(...)`), so dass die jüngste Nachricht oben steht.
- Default-Auswahl bleibt die jüngste Nachricht (in `useEffect` heute `items[items.length - 1]`) — passt weiterhin.
- Reading-Pane bleibt unverändert (zeigt eine einzelne Mail).
- `useMailThread`-Hook bleibt unverändert (intern weiter ASC sortiert; nur die Anzeige wird umgedreht). Das ist bewusst, damit „Default = neueste" einfach `at(-1)` bleibt.

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/inquiryActionState.ts` | `status === "new"` immer `respond` (rot), 24-h-Schwelle entfernen |
| `src/components/admin/refine/EventsList.tsx` | Default-Sort `created_at desc` |
| `src/components/admin/shared/MailClient.tsx` | Sidebar-Liste neu → alt |

## Out of scope
- Andere Listen (Dashboard-Inbox-Column) — die nutzen schon eigene Sortierung.
- Visuelle Anpassung der Farbtöne — Bestand bleibt (rot/orange/grün/grau wie heute, monochromer Modus erlaubt rot für Action-Required).
