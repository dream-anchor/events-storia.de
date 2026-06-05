## Modernes Drag & Drop Upload

### Library
**`react-dropzone`** – Standard-Library, headless, perfekt mit Tailwind/shadcn kombinierbar.

### Neue Komponente `src/components/admin/PhotoDropzone.tsx`
- Vollwertige Dropzone mit Drag & Drop + Klick-Fallback
- Multi-File, max. 20 MB pro Datei
- Akzeptiert JPG, PNG, WebP, AVIF
- **Auto-Upload** sobald Dateien fallen gelassen werden (parallel max. 3 gleichzeitig)
- **Live-Queue** mit Thumbnail, Dateiname und Status pro Datei (Warteschlange / Lädt hoch / KI klassifiziert / Fehler)
- Reject-Toasts für zu große/falsche Dateien
- **Fullscreen-Overlay** wenn der User Dateien irgendwo auf der Seite zieht (Notion/Linear-Style)
- Erfolgreiche Uploads verschwinden nach 4 s aus der Queue
- Design: `rounded-2xl`, Dashed Border, Light-Mode/Monochrom, Inter Font, kein Floating Button

### Integration in `src/pages/admin/Fotoalbum.tsx`
- Bestehender „Fotos hochladen"-Button + Hidden-Input entfernt
- `<PhotoDropzone />` als kompakter Strip oben im Content-Bereich (direkt unter Header)
- Nutzt bestehenden `useUploadPhoto` Hook → keine API-/DB-Änderungen
- Realtime-Subscription aktualisiert Galerie automatisch nach Klassifizierung

### Technik
```bash
bun add react-dropzone  # bereits installiert
```
- Keine Migration, keine Edge Function nötig
- Object-URLs werden korrekt revoked
- `ReturnType<typeof setTimeout>` Konvention eingehalten

### Ausgeschlossen
- Resumable Uploads (Uppy/tus) – Overkill
- Bild-Crop vor Upload
- Drag-Reorder in der Galerie
