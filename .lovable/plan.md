## Ziel

Alle Bilder, die heute in `events-storia.de` (dieses Projekt) und `ristorantestoria.de` (Schwesterprojekt) eingebunden sind, sollen im Foto-Album sofort verfügbar sein — inkl. automatischer KI-Klassifizierung (Kategorie + Tags), genau wie bei Neu-Uploads.

## Bestand

- **events-storia.de**: 59 Bilder unter `src/assets/**` (Catering, Events, Ambiente, Logo etc.).
- **ristorantestoria.de**: ~31 unique Bilder (die `-600w`-Varianten sind nur responsive Duplikate und werden übersprungen).
- Logos / reine UI-Assets (`storia-logo.webp`, Payment-Icons, Favicon) werden ausgeschlossen — gehören nicht ins inhaltliche Album.

Geschätzt landen so ~80 sinnvolle Fotos im Album.

## Lösung: Einmaliger Seed-Import per Admin-Button

Im Fotoalbum (`/admin/fotos`) kommt oben rechts ein dezenter Button **„Bestand importieren"** (nur sichtbar, solange das Album leer/teilleer ist, plus dauerhaft via Overflow-Menü für Re-Runs). Klick → ruft eine neue Edge Function `seed-photo-album` auf.

### Was die Edge Function macht

1. Liest eine **hardcodierte Manifest-Liste** (Pfad + Quelle + optional Hint-Kategorie) aller zu importierenden Bilder beider Sites.
2. Pro Eintrag:
   - **Dedupe-Check**: Wenn in `photo_album` bereits eine Zeile mit `source_origin` + `source_filename` existiert → skip.
   - **Download** des Bildes:
     - events-storia: von der Live-URL `https://events-storia.de/assets/<hashed>.webp` (Hashes werden im Build-Step ermittelt → siehe technische Details).
     - ristorantestoria: analog von `https://ristorantestoria.de/...`.
   - **Upload** in den `photo-album` Storage-Bucket unter `seed/<origin>/<filename>`.
   - **Bildmaße** via `image-size`-Dekodierung (Webp-Header lesen).
   - **Insert** in `photo_album` mit `filename`, `title` (aus Slug → lesbar), `width`, `height`, `file_size`, neuem Feld `source_origin` (`events-storia` | `ristorante-storia`).
   - **Klassifizierung** anstoßen: ruft existierende `classify-photo` Function auf (fire-and-forget) → Kategorie + Tags landen automatisch, Realtime aktualisiert das UI.
3. Gibt am Ende `{ imported, skipped, failed }` zurück. Toast im Admin zeigt z.B. „78 importiert, 2 übersprungen, 0 Fehler".

### Warum so

- **Idempotent**: kann mehrfach laufen, importiert nur neue Dateien.
- **Nutzt bestehende Pipeline**: gleiche Bucket-Struktur, gleiche `classify-photo`, gleiche Realtime-Updates → keine Sonderpfade im Frontend.
- **Kein Build-Zwang**: läuft als Edge Function on demand, nicht beim Deploy.
- **Reversibel**: alle Seed-Einträge sind erkennbar (`source_origin != null`) und können auf einen Schlag gelöscht werden, falls etwas schiefgeht.

## Akzeptanzkriterien

- Button „Bestand importieren" im Fotoalbum sichtbar.
- Klick startet Import, zeigt Lade-Indikator + finalen Toast.
- Nach Import sind alle Bilder beider Sites im Album sichtbar, sortierbar, filterbar.
- KI füllt innerhalb weniger Sekunden Kategorie + Tags pro Bild.
- Zweiter Klick auf den Button importiert nichts erneut (Skip).
- Logos / UI-Icons tauchen NICHT auf.

---

## Technische Details

### Neue Migration
- Spalte `source_origin TEXT NULL` auf `public.photo_album`.
- Spalte `source_filename TEXT NULL` auf `public.photo_album`.
- Composite-Index `(source_origin, source_filename)` für Dedupe.

### Neue Edge Function: `supabase/functions/seed-photo-album/index.ts`
- `verify_jwt = true` (Admin-only via has_role-Check im Body, gleicher Stil wie andere Admin-Functions).
- Manifest inline im Code: Array `{ origin, sourceUrl, filename, displayTitle }`.
- Verwendet `SUPABASE_SERVICE_ROLE_KEY` für Storage + DB-Inserts.
- Nach Upload: `await supabase.functions.invoke("classify-photo", { body: { photoId, photoUrl } })` (fire-and-forget mit `.catch(console.error)`).

### Manifest-Aufbau
- **events-storia**: Build-Step / Vorbereitung listet `src/assets/**` und ermittelt die finalen `/__l5e/...` Asset-URLs (oder Live-URLs nach Deploy). Da das Repo `.asset.json`-Pointer nutzt, ist die URL direkt verfügbar — Manifest wird per kleinem Helper-Skript generiert und ins Function-File geschrieben.
- **ristorantestoria**: Liste der unique Filenames (ohne `-600w`-Varianten) wird ebenfalls ins Manifest eingetragen mit Live-URLs `https://ristorantestoria.de/<path>`.

### Frontend
- `src/pages/admin/Fotoalbum.tsx`: Neuer Button + Mutation `useSeedPhotoAlbum` (ruft Edge Function), Toast für Ergebnis.

### Ausschlussliste (nicht importiert)
`storia-logo.webp`, alle `src/assets/payment-logos/*`, `src/assets/stripe-icons/*`, `public/maestro-favicon.svg`, `public/placeholder.svg`.

## Offene Frage

Soll der Import die Bilder als **„archiviert" markieren** (still im Hintergrund, du sortierst manuell frei), oder direkt **öffentlich/aktiv** ins Album? Standard im Plan: **direkt aktiv** — passt zu deinem Wunsch „sollen im Album schon verfügbar sein".
