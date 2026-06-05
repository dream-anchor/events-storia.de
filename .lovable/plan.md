# Pizze Napoletane: Items archiviert → Menü leer

## Diagnose
Auf `/catering/pizze-napoletane` zeigt die Seite den Empty-State:
„Das Menü wird derzeit aktualisiert. Bitte schauen Sie später wieder vorbei."

Ursache liegt in den Daten, nicht im Code:
- Menü `pizze-napoletane` existiert und ist `is_published = true`.
- Beide Kategorien (`Pizza Pane`, `Pizze Classiche`) sind aktiv.
- **Alle 25 Pizza-Einträge** in `menu_items` wurden am **2026-06-03 21:44:58 UTC** archiviert (`archived_at IS NOT NULL`).
- Der Hook `useCateringMenuBySlug` filtert `archived_at IS NULL`, daher kommt eine leere Liste zurück → Empty-State.

Das war vermutlich eine versehentliche Bulk-Archivierung im Admin.

## Lösung
Migration, die `archived_at` für die 25 Items beider Pizza-Kategorien zurücksetzt (auf `NULL`). Damit erscheinen alle Pizzen sofort wieder auf der Seite.

```sql
UPDATE public.menu_items
SET archived_at = NULL
WHERE category_id IN (
  'cccc3333-3333-3333-3333-333333333331',
  'cccc3333-3333-3333-3333-333333333332'
)
AND archived_at IS NOT NULL;
```

## Nicht enthalten
- Keine Code- oder UI-Änderung. Hook-Logik, Empty-State und Seite bleiben wie sie sind.
- Keine Schemaänderung.
- Bilder/Beschreibungen werden nicht angefasst.

## Betroffen
- DB: `public.menu_items` (25 Zeilen restauriert).

## Hinweis
Falls beim Anlegen neuer Pizzen über den Admin künftig die alten Bulk-Archivierungen wieder reinrutschen, müssten wir das im Admin getrennt anschauen — aktuell beheben wir nur das Symptom auf der öffentlichen Seite.
