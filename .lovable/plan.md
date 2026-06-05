## Ziel
Filter-Chips im Fotoalbum aufräumen: nur noch die 13 vom User gewünschten Kategorien, keine Tags mehr. Cocktail, Wein und Kaffee werden in "Getränke" zusammengefasst.

## Finale Kategorien (13)
Pizza · Pasta · Risotto · Antipasti · Salat · Suppe · Fleisch · Fisch · Dessert · Beilage · Getränk · Ambiente · Team

Entfernt: `cocktail`, `wein`, `kaffee` → fallen in `getränk` zusammen.
Alle Tags werden komplett entfernt (KI kann "scharf", "vegetarisch", "hausgemacht" etc. nicht zuverlässig sehen).

## Änderungen

### 1. `src/lib/photoAlbumVocabulary.ts`
- `PHOTO_CATEGORIES`: `cocktail`, `wein`, `kaffee` entfernen
- `PHOTO_CATEGORY_LABELS`: gleiche 3 Einträge entfernen
- `PHOTO_TAGS_BY_CATEGORY`: alle Arrays auf `[]` (oder Objekt leeren) → `ALL_PHOTO_TAGS` wird automatisch leer
- `PHOTO_CROSS_TAGS`: bleibt `[]`

### 2. `supabase/functions/classify-photo/index.ts`
- `CATEGORIES`: cocktail/wein/kaffee raus
- `TAGS_BY_CATEGORY`: alle Werte auf `[]` → `ALL_TAGS` leer
- System-Prompt: Erkennungsregeln für Cocktail/Wein/Kaffee streichen, stattdessen `getränk` als Sammelkategorie für alle Getränke (Wasser, Softdrink, Wein, Bier, Cocktail, Kaffee, Espresso, Cappuccino …) beschreiben
- Tag-Block aus Prompt entfernen, Tool-Schema behält `tags`-Feld leer (Array bleibt erlaubt, wird aber durch `ALL_TAGS=[]`-Filter auf `[]` reduziert)
- Edge-Function neu deployen

### 3. Bestandsdaten (Hinweis, keine Migration nötig)
Bereits gespeicherte `category='cocktail'|'wein'|'kaffee'` Fotos bleiben in der DB, werden in der UI aber nicht mehr als Filter angeboten. Bei nächster Re-Klassifizierung wandern sie nach `getränk` oder `sonstiges`. Falls gewünscht, kann ich zusätzlich ein einmaliges UPDATE mitliefern, das diese 3 Werte direkt auf `getränk` mappt — sag kurz Bescheid.

## Ergebnis
Im Admin-Fotoalbum erscheinen nur noch die 13 Kategorien-Chips, keine Tag-Chips. Der Tag-Bereich im Edit-Dialog wird automatisch leer (kein Vokabular mehr) und kann bei Bedarf später gezielt ausgeblendet werden.
