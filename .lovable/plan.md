## Ziel
Die 15 aufgelisteten Tags aus dem Foto-Album-Vokabular entfernen, damit die KI sie nicht mehr zuweist und sie nicht mehr als Filterchips angezeigt werden.

## Tags die entfernt werden
- Aus Kategorien: `büffelmozzarella`, `trüffel`, `meeresfrüchte`, `vegetarisch` (pizza), `gegrillt` (fisch), `wasser`, `softdrink`, `saft`, `crodino`, `limonade`
- Aus Querschnitt-Tags: `vegetarisch`, `scharf`, `trüffel`, `meeresfrüchte`, `büffelmozzarella`, `hausgemacht`, `gegrillt`, `signature`, `saisonal`, `mittagskarte`

## Änderungen
1. `src/lib/photoAlbumVocabulary.ts`
   - Tags aus `PHOTO_TAGS_BY_CATEGORY` (pizza, pasta, fisch, getränk) streichen
   - `PHOTO_CROSS_TAGS` entsprechend bereinigen
   - `ALL_PHOTO_TAGS` regeneriert sich automatisch

2. `supabase/functions/classify-photo/index.ts`
   - Tags aus `TAGS_BY_CATEGORY` streichen
   - `CROSS_TAGS` bereinigen
   - System-Prompt aktualisieren (neue `ALL_TAGS`-Liste)

## Hinweis
Bereits in `photo_album.tags` gespeicherte Werte bleiben in der DB bestehen (kein Daten-Migration nötig). Sie werden nur nicht mehr neu vergeben und nicht mehr im UI-Vokabular angeboten.