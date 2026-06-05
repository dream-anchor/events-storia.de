# Fotoalbum: Bugfix + Modernisierung 2026

## Problem-Analyse

In `src/pages/admin/Fotoalbum.tsx`:

1. **Stift-Bug im Auswahl-Modus (Zeile 384):**
   ```tsx
   onClick={(e) => { e.stopPropagation(); if (!selectMode) setEditing(p); }}
   ```
   Im Bulk-Auswahl-Modus wird `setEditing` aktiv blockiert → Bearbeiten unmöglich. Das ist unbeabsichtigt, weil der Stift-Button auch in Auswahl gerendert wird.

2. **Versionen unsichtbar:**
   Das `Layers`-Badge mit Versions-Count (Zeile 373) liegt im Overlay, das `opacity-0` ist und nur bei `hover` oder im Select-Modus erscheint. In der normalen Übersicht sieht man also nie, dass ein Foto mehrere Versionen hat.

## Plan

### 1. Bugfix — Stift funktioniert immer
- `if (!selectMode) setEditing(p)` → `setEditing(p)` (bedingungslos öffnen).
- Klick auf Stift im Bulk-Modus öffnet den Edit-Dialog, ohne die Auswahl zu verlieren.

### 2. Versions-Indikator immer sichtbar
- Das `Layers x N`-Badge aus dem Hover-Overlay herausziehen und als kleine, immer sichtbare Marke oben rechts auf der Kachel rendern (außerhalb des Opacity-Containers).
- Stil: kompaktes Pill mit Glas-Hintergrund (`bg-card/85 backdrop-blur`), Inter, Schichten-Icon + Zahl, monochrom.
- Im Hover-Overlay entfällt das doppelte Badge.

### 3. Modernisierung „Fotoalbum 2026"

Premium-Light-Mode, monochrom, ruhig — keine bunten Akzente.

**Header & Filter**
- Sticky Toolbar oben (rounded-2xl Glaskarte): Suche links, Kategorien als Chip-Reihe mittig, Aktionen (Auswählen / KI neu klassifizieren) rechts.
- Tags rutschen in eine zweite Zeile, scrollbar mit weichen Rändern (Fade-Mask) statt Umbruch.
- Aktiver Filter-Status als kleine, neutrale Pill mit „×".

**Galerie**
- Bleibt Masonry, aber: gleichmäßiger 8px-Gap, leicht abgerundete Ecken (rounded-xl), dezenter Hover-Lift (`translate-y-[-2px]`, weiche Shadow).
- Persistente Meta-Leiste unten auf jeder Kachel (immer sichtbar, kein Hover-Trick):
  - links: Kategorie als monochromes Mini-Label
  - rechts: Versions-Badge falls > 1, „KI klassifiziert…"-Status falls offen
- Hover-Overlay zeigt nur noch die Aktions-Buttons (Stift, optional Vollbild), nicht mehr Metadaten.

**Auswahl-Modus**
- Checkbox dezent in der oberen linken Ecke, immer sichtbar im Select-Modus (nicht im Overlay).
- Ausgewählte Kachel: Ring 2px in `primary`, sanft hervorgehoben.
- Bulk-Toolbar bleibt unten zentriert, Premium-Glas, gleiche Optik wie bestehend.

**Versions-Viewer-Dialog**
- Headline + Untertitel „N Versionen", Grid (3 Spalten) mit Vorschaubildern, aktive Version mit Ring markiert. (Falls Komponente schon existiert, nur Padding/Typo angleichen.)

**Edit-Dialog**
- Zwei-Spalten-Layout (Bild links, Felder rechts) bei `md+`.
- Felder gruppiert: Titel, Beschreibung, Kategorie, Tags, Versionen.
- Aktionen unten-links: „Speichern" (primary), daneben „KI neu klassifizieren", „Archivieren", „Löschen" als ghost-Buttons. Keine floating Buttons.

**Empty-State & Loading**
- Empty: zentriertes neutrales Icon + „Noch keine Fotos. Zieh Dateien in den Bereich oben."
- Loading: Skeleton-Kacheln in Masonry-Form statt Spinner.

### 4. Nicht enthalten
- Keine Änderungen an Datenmodell, Hooks (`usePhotoAlbum`, Versions-Logik) oder Storage.
- Keine neuen Features (z. B. Drag-Sort, Alben, Sammlungen) — nur Visual + zwei Fixes.

## Betroffene Dateien
- `src/pages/admin/Fotoalbum.tsx` (Bugfix + Layout + persistente Meta-Leiste + Filter-Toolbar + Empty/Loading)
- ggf. `src/components/admin/PhotoDropzone.tsx` (Stil angleichen, falls auffällig)
- Versions-Viewer / Edit-Form innerhalb derselben Datei

## Technische Details
- Versions-Badge wird im `render.extras` außerhalb des opacity-Containers gerendert (eigenes absolut positioniertes Element).
- Sticky Toolbar via `sticky top-0 z-30` innerhalb des AdminLayout-Scroll-Containers.
- Keine neuen Dependencies.
