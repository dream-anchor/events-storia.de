## Ziel

Ein zentrales **Foto-Album in Maestro**, in das du Bilder hochlädst. Jedes Foto wird automatisch von KI in **1 Kategorie + 1–5 Tags** aus dem vorgegebenen STORIA-Vokabular einsortiert. Anschließend kannst du Fotos aus dem Album:
1. im **Menü-Item-Editor** als Bild auswählen, oder
2. für **öffentliche Galerien / Hero-Bereiche** verwenden.

## Tech-Stack

- **Storage**: neuer Supabase-Bucket `photo-album` (privat für Upload, public-read über Policy)
- **DB**: neue Tabelle `photo_album`
- **Galerie-UI**: `react-photo-album` (Masonry) + `yet-another-react-lightbox` (Vollbild)
- **Upload**: bestehender Pattern (`useCateringMenuMutations.uploadCateringImage`) als Vorbild
- **KI-Klassifizierung**: Edge Function `classify-photo` → Lovable AI Gateway → `google/gemini-2.5-flash` (multimodal, vision)

## Datenbank

Neue Tabelle `photo_album`:
- `id`, `created_at`, `created_by`
- `storage_path` (z.B. `photo-album/2026/abc.jpg`)
- `url` (public URL, denormalisiert für schnellen Zugriff)
- `filename`, `width`, `height`, `file_size`
- `category` (text, 1 Wert aus Vokabular oder `sonstiges`)
- `tags` (text[])
- `ai_classified` (bool), `ai_confidence` (numeric), `ai_model` (text)
- `title`, `description` (optional, für SEO/Alt-Text)
- `is_archived` (bool, soft-delete)

Plus separate Tabelle `photo_album_usage` (optional, Phase 2) um zu tracken, wo ein Foto verwendet wird (menu_item_id, etc.).

GRANTs für `authenticated` + `service_role`. RLS: Lesen/Schreiben nur für eingeloggte Admins (über `has_role`).

`menu_items.image_url` bleibt wie bisher — wir setzen dort einfach die Album-URL ein, wenn ein Foto ausgewählt wird (keine Schema-Änderung am Menü).

## Storage-Bucket

- Name: `photo-album`
- Public-Read (damit URLs direkt im Frontend und in `menu_items.image_url` funktionieren wie heute bei `catering-images`)
- RLS auf `storage.objects`: nur Admins/Staff dürfen schreiben/löschen, jeder darf lesen
- Pfad-Struktur: `YYYY/MM/<uuid>.<ext>`

## Edge Function `classify-photo`

- Input: `{ photoUrl, photoId }`
- Ruft `https://ai.gateway.lovable.dev/v1/chat/completions` mit `google/gemini-2.5-flash` auf
- Multimodal: image-URL + System-Prompt mit **fest verdrahtetem Vokabular** (16 Kategorien + alle Tags + Querschnitt-Tags)
- Verwendet **Tool-Calling** (`classify_photo` Funktion) für strukturierte Antwort: `{ category, tags[], confidence }`
- Schreibt Ergebnis zurück in `photo_album`-Zeile
- Behandelt 429/402 Errors (Rate-Limit / Credits) sauber
- Wird automatisch nach jedem Upload aufgerufen, kann manuell re-triggered werden ("Erneut klassifizieren")

## Maestro UI (`/admin/fotos` o.ä.)

**Eine neue Seite** `src/pages/admin/Fotoalbum.tsx`:

### Header
- Titel "Fotoalbum"
- Upload-Button (Dropzone, Multi-Upload, max 20 MB/Foto, JPG/PNG/WebP)
- Such-Input (Volltext auf title/description)
- Bulk-Aktionen (Archivieren, Löschen, Erneut klassifizieren)

### Filter-Leiste
- Kategorie-Pills (alle 16 Kategorien + "Alle")
- Tag-Multiselect (Combobox)
- Sortierung (neueste / älteste)

### Masonry-Galerie
- `react-photo-album` mit `layout="masonry"`, responsive Spalten (1/2/3/4 je nach Breakpoint)
- Pro Foto: kleine Kategorie-Badge + Tag-Chips beim Hover
- Klick → `yet-another-react-lightbox` Vollbild mit Metadaten-Sidebar
- In der Lightbox: Tags/Kategorie bearbeiten, Titel/Alt-Text setzen, Foto löschen/archivieren

### Upload-Flow
1. Datei wählen → in `photo-album` Bucket hochladen
2. `photo_album`-Row anlegen (mit `ai_classified=false`)
3. `classify-photo` Edge Function im Hintergrund triggern
4. Realtime-Subscription updated das UI sobald KI fertig ist → Kategorie + Tags erscheinen

## Integration: Menü-Item-Editor

In `MenuItemEditor.tsx` zusätzlich zum bestehenden Upload-Button:
- Neuer Button **„Aus Fotoalbum wählen"**
- Öffnet Dialog mit kompakter Album-Galerie (Filter nach Kategorie, Standard-Filter abhängig von Menü-Kategorie — z.B. öffnet beim Dessert-Item automatisch mit Kategorie `dessert` vorgefiltert)
- Klick auf Foto → setzt `formData.image_url` auf die Album-URL
- Bestehender Direkt-Upload bleibt unverändert erhalten

## Integration: Öffentliche Galerien (Phase 2, in diesem Plan vorbereitet)

- Generischer Hook `usePhotoAlbum({ category?, tags? })` der gefilterte Fotos liefert
- Beispiel-Komponente `<PhotoAlbumGallery category="ambiente" />` die später in Catering-/Events-Seiten gedroppt werden kann
- Im ersten Wurf nur Hook + Komponente bauen, kein Einbau in bestehende Seiten — das macht ihr dann gezielt pro Seite

## Klassifizierungs-Vokabular (in Edge Function fest verdrahtet)

Das vollständige Vokabular aus deiner Nachricht wird als Konstante in der Edge Function abgelegt — sowohl die 16 Kategorien als auch alle kategoriespezifischen Tags und die 10 Querschnitt-Tags. Der System-Prompt erzwingt:
- genau 1 Kategorie (Fallback `sonstiges`)
- 1–5 Tags, ausschließlich aus den Listen
- JSON-Output über Tool-Calling-Schema

## Migration-Schritte (Reihenfolge)

1. Storage-Bucket `photo-album` (public) anlegen
2. Migration: Tabelle `photo_album` + Indizes (`category`, GIN auf `tags`) + RLS + GRANTs + Realtime-Publication
3. Edge Function `classify-photo` (config.toml: `verify_jwt = true`, da Admin-only)
4. NPM-Packages installieren: `react-photo-album`, `yet-another-react-lightbox`
5. Hooks: `usePhotoAlbum`, `useUploadPhoto`, `useClassifyPhoto`
6. Page: `src/pages/admin/Fotoalbum.tsx` + Route in Admin-Navigation
7. `MenuItemEditor.tsx` um "Aus Fotoalbum wählen"-Dialog erweitern
8. Public Hook + Komponente vorbereiten (kein Einbau in Seiten)

## Was NICHT Teil dieses Plans ist

- Automatische Re-Klassifizierung aller existierenden `menu_items`-Bilder (kann später als separater Job laufen)
- Drag-&-Drop-Reordering in öffentlichen Galerien
- Watermark / Bildbearbeitung
- Tatsächlicher Einbau in einzelne öffentliche Seiten (Catering/Events) — dazu sagst du mir Bescheid welche Stellen
