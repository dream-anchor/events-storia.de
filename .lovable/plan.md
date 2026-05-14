## Plan

### Bild-Fix mit erhaltenen Beschriftungen

**Problem:** Beim erneuten Rendern von `storia-uebersicht-details.webp` würden die Beschriftungs-Labels (Captions) im Bild verloren gehen — diese sollen aber erhalten bleiben.

**Lösung:** Statt das Bild zu verändern, wird der visuelle Höhen-Unterschied **rein per CSS** behoben:

1. **Container-Hintergrund angleichen**
   - Die Galerie-Karten bekommen einen einheitlichen `bg-muted` / dunklen Hintergrund, sodass der helle Streifen unten im rechten Bild nicht mehr „abgeschnitten" wirkt.

2. **`object-position` anpassen** (falls nötig)
   - Beide Bilder behalten `object-cover` mit `aspect-[3/2]`, aber das rechte Bild wird leicht via `object-position: center bottom` ausgerichtet, sodass die Captions vollständig sichtbar bleiben.

3. **Optional: Gleicher unterer Rahmen/Padding**
   - Beide Bildkarten bekommen identisches Bottom-Padding, damit Captions visuell „auf gleicher Linie" mit dem linken Bild abschließen.

**Keine Änderung am Bild selbst** — die Beschriftungen bleiben unverändert erhalten.

### Sprach-Übersetzung (wie zuvor besprochen)

Unverändert: UI-Strings statisch in `i18n.ts` (de/en/it/fr), Anschreiben dynamisch via Edge Function `translate-offer-letter` mit Cache in `inquiry.email_content_translations`.

### Geänderte Dateien
- `src/pages/PublicOffer.tsx` (Galerie-Container, CSS only)
- `src/pages/public-offer/i18n.ts` (neu)
- `src/pages/public-offer/AnschreibenSection.tsx`
- `supabase/functions/translate-offer-letter/index.ts` (neu)
- Migration: `email_content_translations jsonb` auf `inquiry`

### Nicht geändert
- Bild-Asset `storia-uebersicht-details.webp` bleibt 1:1 erhalten inkl. Captions.
