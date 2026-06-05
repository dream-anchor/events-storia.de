# KI-Klassifizierung reparieren

## Problem
- Bucket `photo-album` ist privat
- `classify-photo` bekommt eine öffentliche URL übergeben, die nicht erreichbar ist
- Gemini Vision kann das Bild nicht laden → Modell rät blind → alle 30 Fotos als "pizza" klassifiziert
- 24 Fotos bekamen nie eine Antwort, weil Fire-and-forget-Invocations beim Shutdown der Edge Function abbrachen

## Lösung

### 1. `classify-photo` robust machen
- Statt der mitgegebenen `url` auf den `storage_path` aus der DB-Row gehen
- Frische **Signed URL** (1 h) per Service-Role-Key erzeugen und an Gemini schicken
- So funktioniert es unabhängig davon, ob der Bucket privat oder öffentlich ist
- Existierende Fehler-Felder (`ai_error`) sauber befüllen, damit künftige Probleme sichtbar werden

### 2. Neue Edge Function `reclassify-photos`
- Admin-only (gleiches Auth-Pattern wie `seed-photo-album`)
- Holt alle Fotos aus `photo_album` (optional Filter: `?only=unclassified` oder `?only=all`)
- Verarbeitet sie **sequentiell mit `await`** (kein Fire-and-forget) in Batches von ~5 parallel, mit kleinem Delay, um Rate-Limits zu schonen
- Setzt vor jedem Lauf `ai_classified=false`, `category=NULL`, `tags='{}'`, damit fehlerhafte Pizza-Tags überschrieben werden
- Gibt am Ende `{processed, ok, failed, errors[]}` zurück

### 3. `seed-photo-album` anpassen
- Statt Fire-and-forget direkt am Ende des Seedings einen Aufruf an `reclassify-photos` machen (auch await, mit Background-Task via `EdgeRuntime.waitUntil`), damit neue Imports nicht verloren gehen

### 4. Admin-UI Button hinzufügen
- In `src/pages/admin/Fotoalbum.tsx`: zweiter Button **"KI neu klassifizieren"** neben "Bestand importieren"
- Ruft `supabase.functions.invoke("reclassify-photos")` auf, zeigt Toast mit Ergebnis
- Invalidiert anschließend die `photo_album`-Query, damit die neuen Kategorien/Tags sofort sichtbar sind

## Technische Details

**`classify-photo` – Kernänderung:**
```ts
const { data: photo } = await sb.from("photo_album")
  .select("storage_path").eq("id", photoId).single();
const { data: signed } = await sb.storage.from("photo-album")
  .createSignedUrl(photo.storage_path, 3600);
const imageUrl = signed.signedUrl;          // an Gemini schicken
```

**`reclassify-photos` – Kernschleife:**
```ts
const { data: rows } = await admin.from("photo_album")
  .select("id").order("created_at");
for (const batch of chunk(rows, 5)) {
  await Promise.all(batch.map(r =>
    admin.functions.invoke("classify-photo",
      { body: { photoId: r.id, photoUrl: "" } })  // URL wird intern gezogen
  ));
  await sleep(500);
}
```

## Out of Scope
- Bucket auf public umstellen (nicht nötig, signierte URLs lösen das Problem)
- UI-Redesign der Fotoalbum-Seite
