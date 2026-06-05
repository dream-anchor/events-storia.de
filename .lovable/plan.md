Die 6 Kategorie-Bilder auf der Startseite (Events im Storia, Fingerfood, Platten & Sharing, Warme Gerichte, Pizza, Desserts) sind aktuell hartcodiert. Sie sollen aus dem Admin (Speisen & Getränke) heraus austauschbar werden — pro Kategorie ein eigenes Foto.

Vorgehen:

1. Datenbank
- Neue Spalten in `menu_categories`:
  - `image_url` (Text) — Pfad zum hochgeladenen Foto
  - `homepage_slug` (Text, optional) — z. B. `fingerfood`, `platten`, `auflauf`, `pizza`, `desserts` — verbindet eine DB-Kategorie mit einer Karte auf der Startseite
- Bestehende Kategorien werden einmalig vorbelegt (Fingerfood → `fingerfood`, Platten & Sharing → `platten` usw.), damit die richtige Kachel auf der Startseite jeweils das passende Foto bekommt.
- Storage-Bucket: bestehender `catering-images` wird wiederverwendet (öffentlich lesbar, Upload nur durch Admin/Staff).

2. Admin (Speisen & Getränke)
- Im Kategorie-Bearbeiten-Dialog kommt ein Bild-Bereich oben dazu:
  - Vorschau des aktuellen Fotos
  - Button „Bild hochladen / austauschen"
  - Button „Bild entfernen"
- Upload geht direkt in den Storage-Bucket; die URL wird auf der Kategorie gespeichert.
- Bestehende Bearbeiten/Archivieren/Löschen-Icons bleiben unverändert.

3. Startseite (CateringGrid)
- Die 6 Karten bleiben in ihrer fixen Reihenfolge und mit ihrem Routing.
- Für jede Karte wird zur Laufzeit geprüft: gibt es eine `menu_categories`-Zeile mit passendem `homepage_slug` und gesetztem `image_url`? Dann wird dieses Foto verwendet, sonst Fallback auf das aktuelle Standard-Asset.
- „Events im Storia" hat keine Menü-Kategorie. Dafür wird eine kleine, separate Einstellung ergänzt: über die Settings-Seite im Admin kann genau dieses eine Bild ausgetauscht werden (gleicher Upload-Mechanismus), oder das Standard-Asset bleibt.

4. Nicht enthalten
- Texte und Reihenfolge der Karten auf der Startseite bleiben wie sie sind (kein Refactor der CateringGrid-Struktur).
- Mehrsprachiges alt-Tag bleibt aus dem Code; pro Kategorie ergänzen wir später nur bei Bedarf.

Technische Dateien:
- Migration für `menu_categories` (Spalten + Backfill der `homepage_slug` für bestehende Kategorien).
- `src/components/admin/CategoryEditor.tsx` (Bild-Upload-Block).
- Optional ein kleiner Hook/Helper zum Upload in `catering-images`.
- `src/components/CateringGrid.tsx` (Lookup auf DB-Bilder mit Fallback).
- Settings-Eintrag für das Events-Karten-Bild (kleines UI in `src/components/admin/refine/Settings.tsx`).