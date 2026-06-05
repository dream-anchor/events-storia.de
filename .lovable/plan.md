# Fotoalbum: Löschen, Bulk-Aktionen & Versionierung

## Ziel
1. Fotos lassen sich einzeln **und** im Bulk löschen / archivieren.
2. Beim Hochladen kann manuell ein bestehendes Foto ausgewählt werden → neues Foto wird **Version 2, 3, …** des bestehenden. Älteste Version bleibt sichtbar als „Vorgänger".
3. Im Grid zeigt ein **Blätter-Icon** an, dass mehrere Versionen existieren. Klick auf das Foto öffnet einen Versions-Viewer (Lightbox mit Vor-/Zurück durch die Versionen + Datum-Label "v3 · aktuell", "v2", "v1").
4. Keine automatische Duplikat-Bereinigung — bestehende Doppelten werden manuell über Bulk-Auswahl + Versionierung zusammengeführt.

## Datenmodell

Neue Spalten auf `photo_album` (Migration):
- `parent_photo_id uuid REFERENCES photo_album(id) ON DELETE SET NULL` — verweist auf den Foto-„Stamm" (Version 1).
- `version int NOT NULL DEFAULT 1` — 1, 2, 3, …
- `is_current boolean NOT NULL DEFAULT true` — markiert die aktuelle Version pro Stamm.

Regeln (im Code, nicht via CHECK):
- Eine neue Version setzt `parent_photo_id` auf die ID von Version 1 (oder auf sich selbst nur konzeptuell — wir speichern bei v1 `parent_photo_id = NULL`, alle Nachfolger zeigen auf v1).
- Beim Anlegen einer neuen Version: alle bisherigen Versionen desselben Stamms → `is_current = false`, neue Version `is_current = true`, `version = max(version)+1`.
- Standard-Query (Grid) filtert `is_current = true`.

Index: `(parent_photo_id, version DESC)`.

## UI-Änderungen (`src/pages/admin/Fotoalbum.tsx`)

**Bulk-Modus:**
- Toggle „Auswählen" oben rechts → Checkboxen auf jedem Foto (Overlay top-left).
- Auswahl-Toolbar (sticky unten): `n ausgewählt · Löschen · Archivieren · Als Version zuordnen…`
- „Als Version zuordnen…": öffnet Dialog → Ziel-Foto (Stamm) auswählen → alle markierten Fotos werden als neue Versionen daran gehängt (in Reihenfolge der Auswahl, älteste zuerst → höhere Versionen).

**Einzelfoto:**
- Bestehender Edit-Dialog bekommt zusätzlich:
  - Knopf „Als neue Version von… zuordnen" (öffnet Such-Picker über andere Fotos).
  - Wenn das Foto Versionen hat: Liste „Versionen (v3 aktuell, v2, v1)" mit „Als aktuell setzen" / „Version löschen".

**Versions-Indikator im Grid:**
- Wenn `version_count > 1` für den Stamm → kleines Stack-Icon (z.B. `Layers` aus lucide-react) oben rechts auf dem Thumbnail mit Badge "3".
- Lightbox: zeigt zusätzlich Versions-Slider unten — alle Versionen des angeklickten Stamms, Label „v3 · aktuell · 5. Juni 2026", Pfeile blättern zwischen Versionen.

## Upload-Flow (`PhotoDropzone` + `useUploadPhoto`)

- `useUploadPhoto.mutate(file, { asVersionOf?: photoId })`
- Wenn `asVersionOf` gesetzt:
  1. Foto wie bisher hochladen.
  2. Stamm = `parent_photo_id ?? id` des Ziel-Fotos.
  3. Neue Reihe einfügen mit `parent_photo_id = stamm`, `version = max+1`, `is_current = true`.
  4. Alle anderen Versionen des Stamms → `is_current = false`.
- Dropzone bekommt optionalen „Als Version von …" Modus (wird vom Edit-Dialog/„Foto ersetzen"-Aktion getriggert).

## Hooks (`src/hooks/usePhotoAlbum.ts`)

- `usePhotoAlbum` per default `.eq('is_current', true)` zusätzlich zu `is_archived = false`.
- Neuer `usePhotoVersions(stammId)` → alle Versionen sortiert nach `version DESC`.
- Neue Mutationen: `useBulkDeletePhotos`, `useBulkArchivePhotos`, `useAssignAsVersions({ parentId, photoIds })`, `useSetCurrentVersion(id)`, `useDeleteVersion(id)`.

## Bibliotheken
- `react-photo-album` + `yet-another-react-lightbox` (bereits installiert) — Lightbox-Plugins `Counter` und `Captions` für Versions-Label.
- Keine zusätzlichen Libs nötig. Versions-Switcher wird als custom toolbar im Lightbox-Slot eingebaut.

## Nicht im Scope
- Keine automatische Bild-Ähnlichkeits-Erkennung.
- Keine KI-Duplikatsuche.
- Bestehende Duplikate werden ausschließlich manuell zusammengeführt (Bulk-Auswahl → „Als Version zuordnen").

## Technische Details
- Migration: `ALTER TABLE photo_album ADD COLUMN parent_photo_id uuid, ADD COLUMN version int NOT NULL DEFAULT 1, ADD COLUMN is_current boolean NOT NULL DEFAULT true;` + Index + FK `ON DELETE SET NULL`.
- Storage-Files werden beim Löschen einer Version mit entfernt (`storage.remove`).
- Beim Löschen der aktuellen Version eines Stamms mit weiteren Versionen → höchste verbleibende Version wird `is_current = true`.
- RLS: Bestehende Policies auf `photo_album` gelten weiter (keine neuen Policies nötig).
