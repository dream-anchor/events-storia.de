# Bug: Alle Bestellungen landen in „Neu / offen"

## Diagnose (Red Team Review)

Screenshot 2 (`/admin/orders`, Bucket „Eingang"): **33 Bestellungen in „Neu / offen", alle mit Label „STORNIERT".** Das ist die Quelle der Verwirrung — du dachtest, „Anfragen" sind durcheinander; tatsächlich ist es die **Bestellungen-Kanban**, die ich gerade umgebaut habe.

### Root Cause
In `src/components/admin/refine/OrdersKanbanView.tsx` Zeile 362–365:

```ts
const fallback = columns[0]?.id;
orders.forEach((o) => {
  const target = columns.find((c) => c.match(o))?.id ?? fallback;
  ...
});
```

- `OrdersList` übergibt **alle 33 Orders** (ungefiltert, `kanbanQuery` ohne Status-Filter) an die Kanban-Komponente.
- Der Bucket `inbox` hat nur Sub-Columns für `pending` + `confirmed`.
- Cancelled/Completed Orders matchen keine Spalte → Fallback wirft sie in `columns[0]` = **„Neu / offen"**.
- Ergebnis: Im „Eingang"-Bucket erscheinen 19 cancelled + 14 completed Orders als „Neu / offen". Die Bucket-Counts oben (`Eingang 0 / Erledigt 14 / Archiv 19`) stimmen aber, weil sie separat in `OrdersList` korrekt gefiltert werden.

### Screenshot 1 (Anfragen): kein Bug
`/admin/inquiries` zeigt 15 aktiv → 1 in „Angebot verschickt" + 7 in „Gebucht" = 8 sichtbar. Die fehlenden 7 sind vermutlich in Status `paid`/`offer_chosen`, die im aktuellen `won`-Bucket dort nicht angezeigt werden — das ist eine bestehende Layoutfrage, nicht die heute eingeführte Regression. Außerhalb des Scopes dieses Fixes (kann separat angegangen werden, falls erwünscht).

## Fix (1 Datei, chirurgisch)

**`src/components/admin/refine/OrdersKanbanView.tsx`** — Fallback entfernen, sodass nur Orders gezeigt werden, die wirklich zu einer Sub-Column des aktiven Buckets passen:

```diff
- const fallback = columns[0]?.id;
  orders.forEach((o) => {
-   const target = columns.find((c) => c.match(o))?.id ?? fallback;
+   const target = columns.find((c) => c.match(o))?.id;
    if (!target || !data[target]) return;
    data[target].items.push(o);
    data[target].totalSum += o.total_amount || 0;
  });
```

Damit:
- **Eingang** zeigt nur noch `pending` + `confirmed` Orders.
- **Erledigt** zeigt nur `completed`.
- **Archiv** zeigt nur `cancelled`.
- Bucket-Pills-Counts (oben) und Spalten-Counts (in Kanban) sind dann konsistent.

## Verifikation

1. Build via Lovable-Pipeline.
2. Visuell prüfen (Preview): `/admin/orders` → Bucket „Eingang" sollte leer/0 Karten zeigen (DB-Check ergibt 0 pending+confirmed), Bucket „Archiv" zeigt 19 cancelled, Bucket „Erledigt" zeigt 14 completed.
3. Drag-Test: Karte von „Erledigt" → blockiert (kein anderer Bucket sichtbar), Status-Dropdown auf Karte funktioniert weiter (verschiebt Bucket-übergreifend per Status-Change).

## Out of Scope (Hinweise)

- Inquiries-Kanban (Screenshot 1): keine Änderung. Falls die 7 „verschwundenen" Anfragen-Status (`paid`, `offer_chosen` etc.) sichtbarer werden sollen → separater Auftrag.
- `OrdersList.counts` (Zeile 90–101) hat einen TODO-Kommentar — ebenfalls separat.
