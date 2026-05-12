
## Warum „Gebucht" leer ist

Beim letzten Fix habe ich die **Kanban-Spalten an die Filter-Pills gekoppelt**. Klickt man oben auf „Eingang", verschwindet im Kanban die Spalte „Gebucht" — weil die zur Pipeline gehört, aber nicht zum Filter.

Daten in der DB (heute):
- 4 × `paid` (alle in Zukunft) → das sind die echten gebuchten Events
- 11 × `completed` (alle vergangen) → erledigt
- 30 × `offer_chosen` (alle vergangen) → Kunde hat Angebot gewählt, nie als bezahlt markiert (Datenleichen)
- 20 × `cancelled` → Archiv
- 1 × archiviert (`archived = true`)

Das Konzept war inkonsistent, weil **Kanban (Pipeline) und Tabelle (Status-Filter) zwei verschiedene Mentalmodelle vermischt** wurden.

---

## Das neue, stabile Konzept

**Eine einzige Wahrheit pro Anfrage:** der `lifecycle`-Bucket. Jede Anfrage ist genau in einem Bucket. Kanban und Tabelle nutzen denselben Bucket — keine Doppellogik.

### Die 4 Buckets (genau diese, nichts dazwischen)

| Bucket | Was drin ist | Quelle |
|---|---|---|
| **Eingang** | Aktive Anfragen in Bearbeitung | `status ∈ {inquiry, offer_draft, offer_sent}` und nicht archiviert/storniert |
| **Gebucht** | Bestätigte, kommende Events | `status ∈ {offer_chosen, paid}` und `date >= heute` und nicht archiviert/storniert |
| **Erledigt** | Vergangene oder explizit abgeschlossene Events | `status = completed` ODER (`status ∈ {offer_chosen, paid}` und `date < heute`) |
| **Archiv** | Storniert / abgelehnt / manuell archiviert | `archived = true` ODER `status ∈ {cancelled, offer_declined, payment_failed, no_response}` |

Regeln:
- **Genau ein Bucket pro Anfrage** — keine Überschneidung.
- **`archived = true` ist die einzige Quelle für „archiviert"** — `archived_at` allein zählt nicht (Datenleichen ignorieren / aufräumen).
- **Datum entscheidet automatisch über Eingang→Erledigt**: am Tag nach dem Eventdatum wandert ein gebuchtes Event in „Erledigt". Frontend-derived, kein Cron nötig.
- **Catering-Shop-Bestellungen** folgen demselben Schema (mapping in `mapCateringToColumn`).

### Kanban-Ansicht

Kanban zeigt **immer nur den aktuell gewählten Bucket**, aufgeteilt in feinere Spalten:

```
Eingang   →  [Neu] [In Bearbeitung] [Angebot raus]
Gebucht   →  [Bestätigt] [Bezahlt]                  (sortiert nach Eventdatum aufsteigend)
Erledigt  →  [Abgeschlossen]                        (sortiert nach Eventdatum absteigend)
Archiv    →  [Storniert] [Abgelehnt] [Manuell archiviert]
```

Der Filter-Pill oben (Eingang / Gebucht / Erledigt / Archiv) wechselt also nicht nur die Tabelle, sondern auch die Kanban-Spalten. Das ist konsistent: ein Klick = ein Bucket.

### Tabellen-Ansicht

Identisch — dieselben 4 Pills, dieselbe Filterlogik, nur als flache Liste statt als Spalten.

### Sortierung pro Bucket (Default)

- **Eingang**: neueste zuerst (`created_at desc`)
- **Gebucht**: nächstes Event zuerst (`date asc`)
- **Erledigt**: zuletzt vergangenes zuerst (`date desc`)
- **Archiv**: zuletzt geändert (`updated_at desc`)

---

## Was umgesetzt wird (Code)

1. **`src/types/inquiryRecord.ts`** — Neue Funktion `getLifecycleBucket(r): "inbox" | "won" | "done" | "archive"` als **einzige** Bucket-Quelle. `mapV2EventToColumn` bleibt nur für die Kanban-Sub-Spalten. `isPastEvent` wird in `getLifecycleBucket` integriert.

2. **`src/components/admin/refine/UnifiedInquiriesList.tsx`**
   - `statusMatches` ersetzt durch `getLifecycleBucket(r) === filter`.
   - Default-Sortierung pro Bucket setzen.
   - Hinweis-Text aktualisieren.

3. **`src/components/admin/refine/UnifiedKanbanView.tsx`**
   - Spalten-Set abhängig vom aktiven Bucket (4 verschiedene Layouts).
   - Drag-and-Drop nur innerhalb desselben Buckets erlaubt; Bucket-Wechsel (z.B. „archivieren", „als bezahlt markieren") via Card-Menü, nicht via Drag.

4. **DB-Hygiene (einmalig, separate Migration)**
   - `UPDATE v2_events SET archived_at = NULL WHERE archived = false AND archived_at IS NOT NULL;` (Datenleichen entfernen — bereits geplant, nochmal verifizieren).
   - **Optional, mit Rückfrage:** Die 30 `offer_chosen` mit Datum < heute auf `completed` setzen, damit sie sauber in „Erledigt" landen (statt durch Datums-Heuristik). → siehe offene Frage.

5. **Visuelle Klarheit**
   - Pill-Counts zeigen exakt die Bucket-Größe — keine Diskrepanz mehr zwischen Anzeige und Inhalt.
   - Header-Text: „X Einträge in „{Bucket}"" — gleich für Kanban und Tabelle.

---

## Offene Frage

Die 30 alten `offer_chosen`-Einträge (alle in der Vergangenheit, nie auf `paid` umgestellt): Sollen die per Migration auf `completed` gesetzt werden, damit der Status sauber ist? Oder sollen sie nur über das Datum in „Erledigt" einsortiert werden und der Status bleibt wie er ist?

Empfehlung: **auf `completed` setzen** — saubere Datenbasis, keine zukünftige Verwirrung mehr.
