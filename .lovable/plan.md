## Ziel

Aus allen jemals erstellten Angeboten die **Personal-** und **Equipment-Einträge** extrahieren, pro **Paket** gruppieren, mit den Katalogen abgleichen und als **herunterladbare Datei** bereitstellen.

## Datenquellen (verifiziert)

- `public.v2_offer_options.menu_selection` (JSONB) — Felder `equipment[]` und `staff[]` mit `{ id, name, quantity, pricePerUnit }`.
  - 4 Optionen mit Equipment, 2 mit Personal, 58 mit `package_id`.
- `public._legacy_inquiry_offer_options.menu_selection` — aktuell **0** Treffer für Equipment/Staff, wird trotzdem mitgelesen (Vollständigkeit).
- `public.packages` (`id`, `name`) — Paket-Referenz + Snapshot-Name aus `package_name_snapshot`.
- `public.equipment_catalog` (2 Einträge) und `public.staff_catalog` (5 Einträge) — für Katalog-Abgleich.
- `public.v2_events` — für Angebotsnummer/Kunde/Datum in der Rohliste.

## Umfang

Umfassend, wie gewünscht:

1. **Angebote**: Alle Zeilen aus `v2_offer_options` + `_legacy_inquiry_offer_options`, unabhängig von `is_active`, versioniert.
2. **Katalog-Abgleich**: Marker pro Zeile — `in_katalog = ja/nein` (Name-Match, case-insensitive, getrimmt).
3. **Paket-Gruppierung**: über `package_id` (Fallback: „Ohne Paket").

## Aufbau der Excel-Datei

Eine `.xlsx` mit fünf Sheets, Font Arial, Zahlen in `#.##0,00 €`:

1. **Übersicht** — Erzeugungszeitpunkt, Zeilen-/Angebotszähler, Sheet-Legende.
2. **Personal – Aggregiert** — je (Paket, Name): Anzahl Verwendungen, Ø/Min/Max Einzelpreis, Summe Menge, letzte Verwendung (Datum), `in_katalog`.
3. **Personal – Rohdaten** — je Einzelverwendung: Paket, Name, Menge, Einzelpreis, Zeilen-Summe, Angebot-ID, Version, Angebotsnummer, Kunde, Event-Datum, Quelle (v2/legacy), `in_katalog`.
4. **Equipment – Aggregiert** — analog zu Personal.
5. **Equipment – Rohdaten** — analog zu Personal.

Summen in Aggregat-Sheets als Excel-Formeln (`SUMPRODUCT`, `AVERAGEIFS` etc.), nicht als hartkodierte Werte.

## Umsetzung

1. **Extraktion via SQL** (`supabase--read_query`) — zwei JSONB-Unwrap-Queries (equipment/staff) über `v2_offer_options` + `_legacy_inquiry_offer_options`, jeweils mit Join auf `packages`, `v2_events` und einem `LEFT JOIN` auf `equipment_catalog` / `staff_catalog` per `lower(trim(name))` für den Katalog-Marker.
2. **Excel-Bau** mit dem xlsx-Skill (openpyxl), Aggregation via `pandas.groupby`, danach `recalculate_formulas.py`.
3. **Ablage** in `/mnt/documents/angebote-personal-equipment-<YYYY-MM-DD>.xlsx`, Link im Chat.

Keine Code-Änderungen am Admin-UI, keine neuen Buttons — reiner Export-Job. Falls dauerhaft im Admin benötigt, kann das in einem separaten Plan ergänzt werden.

## Technische Details

- JSONB-Unwrap:
  ```sql
  SELECT o.id, o.version, o.package_id, p.name AS package_name,
         e.value->>'name' AS item_name,
         (e.value->>'quantity')::numeric AS quantity,
         (e.value->>'pricePerUnit')::numeric AS price
  FROM public.v2_offer_options o
  LEFT JOIN public.packages p ON p.id = o.package_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.menu_selection->'staff','[]'::jsonb)) e
  WHERE jsonb_typeof(o.menu_selection->'staff') = 'array';
  ```
- Katalog-Marker: `LEFT JOIN staff_catalog sc ON lower(trim(sc.name)) = lower(trim(e.value->>'name'))`.
- Rohdaten enthalten `created_at` als sortierbares ISO-Datum.
