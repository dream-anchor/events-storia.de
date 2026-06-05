# Alle Catering-Gerichte auf die neuen Fotos umstellen

## Status (live aus DB)

Die meisten Gerichte ziehen bereits die neuen Uploads aus dem CMS-Bucket `catering-images/menu-items/`. **5 Gerichte** zeigen jedoch noch die alten statischen Bilder aus `/public/catering/...webp` (Build-Assets von vor der CMS-Umstellung):

| Gericht | Menü | Aktuelles `image_url` |
|---|---|---|
| Burratina mit confierten Kirschtomaten | buffet-fingerfood | `/catering/fingerfood/burratina.webp` |
| Oktopus-Kartoffelsalat | buffet-fingerfood | `/catering/fingerfood/oktopus.webp` |
| Spiedini di Mozzarelline – Platte | buffet-platten | `/catering/platten/spiedini.webp` |
| Bruschette – Platte | buffet-platten | `/catering/platten/bruschette.webp` |
| Vitello Tonnato-Platte | buffet-platten | `/catering/platten/vitello-tonnato.webp` |

Gleichzeitig liegen im Bucket **9 neue Uploads aus den letzten 3 Tagen, die noch keinem Gericht zugeordnet sind** (Dateinamen sind Zufalls-Hashes, der Inhalt lässt sich nur visuell zuordnen):

```
1780602014684-u95dh.png     1780601995606-7nwdc9.JPG
1780601407425-hrcgxh.png    1780601185715-lv60z8.jpg
1780600638302-tpr6fx.png    1780599804144-c17t98.png
1780599555441-ngj0mh.png    1780598326258-pp3f19.png
1780596016836-y0mlze.png
```

Diese 9 Uploads gehören vermutlich teilweise zu den 5 Gerichten oben (oder zu Ristorante-Items). Welche Datei welches Gericht zeigt, weiß nur der Betreiber – die Hash-Dateinamen geben keinen Hinweis.

## Vorgehen

**Schritt 1 – Zuordnung klären (kein Code)**
Ich öffne die 9 unzugeordneten Uploads als Bildvorschau und ordne sie visuell den 5 Gerichten zu. Wenn die Zuordnung eindeutig ist, übernehme ich sie. Bei Unklarheiten frage ich gezielt zurück (z. B. „Welches der beiden Burratina-Fotos soll verwendet werden?").

**Schritt 2 – `image_url` in der DB aktualisieren**
Für jedes der 5 Gerichte wird `menu_items.image_url` per Daten-Update auf die neue öffentliche Storage-URL gesetzt:
```
https://sovlfqncotxcjqseeawp.supabase.co/storage/v1/object/public/catering-images/menu-items/<datei>.png
```
Kein Schema-Migration nötig, nur `UPDATE`. Durch den bereits gefixten Live-Refetch werden die neuen Bilder sofort ohne Deploy sichtbar.

**Schritt 3 – Verifikation**
Nach dem Update prüfe ich, dass alle 31 veröffentlichten Catering-Items eine `image_url` aus `catering-images/menu-items/` haben (keine `/catering/*.webp` mehr). Anschließend kurzer Sichttest auf `/catering/buffet-fingerfood` und `/catering/buffet-platten`.

## Was bleibt unangetastet

- Keine Änderungen am Frontend-Code – der Live-Refetch-Fix vom letzten Schritt reicht aus.
- Keine Änderungen an `static-menus.json` (wird beim nächsten Build automatisch aktualisiert).
- Keine Änderungen an Schema, RLS oder Storage-Policies.

## Offene Frage an den Betreiber (falls Zuordnung unklar bleibt)

Falls ich die 9 Uploads nicht eindeutig den 5 Gerichten zuordnen kann, ist die Alternative: Der Betreiber lädt im CMS für die 5 betroffenen Gerichte einfach noch einmal ein Foto hoch – dann setzt das CMS `image_url` automatisch korrekt und der Fall ist erledigt.
