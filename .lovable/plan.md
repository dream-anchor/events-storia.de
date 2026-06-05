## Ziele
1. **KI-Klassifizierung deutlich treffsicherer** — kein „Pizza für alles" mehr, korrekte Pasta-/Antipasti-/Ambiente-Erkennung.
2. **Alle Fotos automatisch als optimiertes WebP** — beim Upload und retroaktiv für den bestehenden Bestand. Klein, scharf, SEO-/GEO-tauglich.

---

## Teil 1 — KI-Erkennung massiv verbessern

### Diagnose des aktuellen Verhaltens
- Modell `google/gemini-2.5-flash` — kostengünstig, aber im Vision-Detail zu schwach für Pasta-Sorten, Antipasti-Varianten, Ambiente-Details.
- Prompt wirft alle ~100 Tags in eine flache Liste → das Modell "rät" Tags ohne harte Bindung ans Bild.
- Kein Beschreibungs-Schritt vor Klassifizierung — das Modell springt direkt zur Kategorie und kippt in Heuristiken (= „Pizza" als Default für rundes Essen).
- Sprechende Dateinamen (z. B. `tagliatelle-trueffel.jpg`) werden ignoriert.
- Niedrige Confidence wird trotzdem als „klassifiziert" persistiert.

### Änderungen in `supabase/functions/classify-photo/index.ts`

1. **Modell-Upgrade auf `google/gemini-2.5-pro`**, Fallback auf Flash bei `429`/Rate-Limit. Bei einem Album dieser Größenordnung finanziell vertretbar.
2. **Zwei-Stufen-Pipeline in einem Tool-Call** (`classify_photo`-Schema erweitern):
   - `visible_description` (string, Pflicht) — freie Bildbeschreibung: was ist physisch zu sehen (Gericht, Hauptzutaten, Setting, Geschirr).
   - `category` aus der Whitelist + `tags` (1–5).
   - `confidence` (0–1).
   Das Description-First-Pattern reduziert nachweislich Halluzinationen.
3. **Strukturierter System-Prompt mit Erkennungs-Regeln pro Kategorie** und expliziten Negativ-Regeln gegen den aktuellen „alles Pizza"-Bias, z. B.:
   - „Pizza = runder Boden mit sichtbarem Käse/Belag aus dem Steinofen. Kein Boden sichtbar → NICHT Pizza."
   - „Sichtbare Nudeln → pasta. Sichtbarer Reis cremig → risotto. Brett/Teller mit Aufschnitt/Käse/Tatar/Carpaccio → antipasti."
   - „Innenraum/Tisch/Bar ohne dominantes Gericht → ambiente."
4. **Filename + bestehende `title`/`description` als Hint** mit in den User-Prompt geben (`"Hinweis aus Dateiname: …"`). Bei klaren Filenames (`aperol-spritz-…`) steigt die Trefferquote drastisch — kostenlos.
5. **Confidence-Gate**: bei `confidence < 0.45` → `category = "sonstiges"`, `ai_error = "Niedrige Erkennungs-Confidence – bitte manuell prüfen"`. Das macht schwache Treffer in der UI sichtbar statt sie als „klassifiziert" zu tarnen.
6. **`visible_description` als SEO/GEO-Alt-Text** in `photo_album.description` schreiben, wenn dort noch nichts steht. Nützlich für `<img alt>` und structured data.
7. **Robustes Bild-Laden**: signed URL (bereits da) bleibt; zusätzlich Fallback, der das Bild fetched und als base64-`data:`-URL an Gemini gibt. Damit fällt der „blind ratende" Fall weg, falls die signed URL nicht direkt vom Modell ladbar ist.

### Effekt
Erkennung springt von „Pizza für alles" auf produktionsreif. Nach Deploy einmal `reclassify-photos` (`mode: "all"`) anstoßen.

---

## Teil 2 — WebP-Konvertierung (Upload + Bestand)

### Standard für alle Fotos
- Format: **WebP**, Quality `82`, max. Long-Edge **1920 px**.
- Storage-Pfad endet auf `.webp`, `contentType: "image/webp"`.
- `file_size`, `width`, `height` aus dem konvertierten Bild gespeichert.
- SEO/GEO: signifikant kleinere Files → besserer LCP/CLS auf `RestaurantGallery` & `PhotoAlbumGallery`, schnellere Crawler-Indexierung.

### A) Beim Upload (Client) — `src/hooks/usePhotoAlbum.ts`
- Neue Util `convertToWebp(file, { maxEdge: 1920, quality: 0.82 })`:
  - Bild in `Image`, in `OffscreenCanvas` (Fallback: `HTMLCanvasElement`) skaliert rendern.
  - `canvas.toBlob(blob, "image/webp", 0.82)`.
  - Fallback wenn Browser kein WebP-Encoding kann (alte Safari): Original hochladen, Server konvertiert es retroaktiv.
- `useUploadPhoto` ruft `convertToWebp` vor dem Storage-Upload. Filename → `<original-name>.webp`, `storage_path` mit `.webp`, `contentType: "image/webp"`.
- Dropzone bleibt offen für JPG/PNG/WebP/AVIF/HEIC (HEIC → Server-Fallback).
- UI-Hinweis bleibt: „KI klassifiziert automatisch · wird als WebP optimiert".

### B) Retroaktiv für den Bestand (Edge Function) — neu: `supabase/functions/convert-photos-to-webp/index.ts`
- Admin/Staff-only (gleiches JWT-Pattern wie `reclassify-photos`).
- Iteriert `photo_album` in Batches (4 parallel, 600 ms Pause).
- Pro Foto:
  1. Original-Bytes aus Storage laden.
  2. Skip, falls schon `image/webp` UND `width ≤ 1920` UND `file_size < 400 KB` (idempotent).
  3. Konvertierung mit `https://deno.land/x/imagescript@1.2.17/mod.ts` (reines WASM, kein nativer Bin, läuft in Supabase-Edge).
  4. Neuer `storage_path` = alter Pfad mit `.webp`-Endung.
  5. `upload(upsert=true)` neue Datei, alten Pfad entfernen, falls Endung sich änderte.
  6. `photo_album` Update: `storage_path`, `url`, `file_size`, `width`, `height`, `filename`.
- Response: `{ processed, converted, skipped, failed, errors[] }`.
- Kann beliebig oft laufen (idempotent).

### C) UI-Button im Admin — `src/pages/admin/Fotoalbum.tsx`
- Dritter Button **„Bilder optimieren (WebP)"** neben „KI neu klassifizieren" und „Bestand importieren". Confirm-Dialog + Toast-Feedback wie `runReclassify`.

---

## Technische Notizen
- Keine DB-Migration nötig — alle Spalten existieren (`storage_path`, `url`, `file_size`, `width`, `height`, `description`, `ai_error`, `ai_model`).
- `supabase/config.toml` braucht keine Änderung (beide Functions admin-aufgerufen mit JWT).
- Bucket `photo-album` bleibt privat; signed URLs aus `usePhotoAlbum` (bereits implementiert).
- Reihenfolge nach Deploy:
  1. Edge Functions deployen.
  2. **„Bilder optimieren (WebP)"** einmal anstoßen (~1 Min).
  3. Danach **„KI neu klassifizieren"** — arbeitet auf sauberen, kleinen WebPs mit Pro-Modell.

## Nicht im Scope
- Mehrfach-Größen / `srcset` (kann als 2. Iteration kommen).
- Manueller Alt-Text-Editor in der UI (Description wird nur befüllt).
- Visuelle Änderungen an Public-Galerien — sie profitieren automatisch von kleineren WebPs.
