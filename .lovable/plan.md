## Ursache der 29 Fehler

Live-Test der Edge Function liefert für **jedes PNG**:

```
img.encodeWEBP is not a function
```

`imagescript` (was wir aktuell nutzen) kann WebP **nicht** encodieren — nur PNG und JPEG. Daher schlägt jede der 29 nicht-WebP-Quelldateien fehl. Die 25 „übersprungen" sind bereits kleine WebPs aus dem Seed.

## Fix: auf jSquash umstellen (Google WASM-Codecs, Deno-kompatibel)

`@jsquash/webp` + `@jsquash/png` + `@jsquash/jpeg` sind reine WASM-Pakete, laufen zuverlässig im Supabase Edge Runtime und werden auch von Squoosh selbst genutzt. WebP-Encoder bietet echten `quality`-Parameter.

### Änderungen in `supabase/functions/convert-photos-to-webp/index.ts`

1. Imports tauschen:
   ```ts
   import { decode as decodePng }  from "https://esm.sh/@jsquash/png@3.0.1?target=deno";
   import { decode as decodeJpeg } from "https://esm.sh/@jsquash/jpeg@1.5.0?target=deno";
   import { decode as decodeWebp, encode as encodeWebp } from "https://esm.sh/@jsquash/webp@1.4.0?target=deno";
   ```
2. Neue `decodeImage(bytes, contentType, path)`: per Magic-Bytes/Extension auf den passenden Decoder routen → `ImageData { data, width, height }`.
3. Resize: einfache Nearest-/Bilinear-Resize-Funktion auf `ImageData` (max. Kante 1920). Klein gehalten, kein zusätzliches Package.
4. Encode: `await encodeWebp(imageData, { quality: 82 })` → `Uint8Array`.
5. Skip-Logik bleibt: bereits `.webp` + `< 400 KB` + `width ≤ 1920` → überspringen. Zusätzlich: wenn neuer WebP-Bytecount größer als Original → überspringen (kein Downgrade).
6. Batch-Größe von 3 → **2**, Delay 400 → **600 ms**, um CPU/Memory-Spitzen im Edge Runtime bei großen PNGs (~3 MB → 1920×… RGBA-Buffer) zu glätten.
7. `console.error` je Fehler loggen, damit die echten Meldungen in den Edge-Function-Logs erscheinen (heute sehen wir Fehler nur im JSON-Response).
8. Klarer Response-Body unverändert (`processed/converted/skipped/failed/errors`).

### Keine weiteren Änderungen

- DB-Schema, Buckets, RLS, signed-URLs, Upload-Pfad (`src/lib/convertToWebp.ts` clientseitig) bleiben unverändert.
- UI in `src/pages/admin/Fotoalbum.tsx` bleibt; Toast zeigt automatisch die echten Zahlen.
- KI-Klassifizierung wird nicht angefasst.

### Validierung nach Deploy

1. `deploy convert-photos-to-webp`
2. Funktion einmal per curl aufrufen → erwartet: `failed: 0`, `converted: 29`, `skipped: 25`.
3. Stichprobe: eine konvertierte Datei in DB prüfen (`file_size`, `width ≤ 1920`, Pfad endet `.webp`).
4. Edge-Logs auf neue Fehler kontrollieren.

### Risiken

- jSquash lädt WASM beim ersten Call (~1–2 s Cold Start). Akzeptabel für Admin-Aktion.
- 1920×1080 PNG → RGBA-Buffer ~8 MB im RAM. Mit Batch 2 unter dem 150 MB Edge-Limit.
- Falls einzelne Bilder weiterhin fehlschlagen (z.B. CMYK-JPEG): Fehlertext steht jetzt in den Logs und im UI-Toast – kann gezielt nachgezogen werden.
