# Neue Gerichte aus dem CMS sofort auf der Website zeigen

## Problem
Du legst im CMS (Maestro) neue Fingerfood-/Catering-Gerichte mit Fotos an — sie erscheinen aber erst nach einem neuen Deploy auf den Seiten unter `/catering/*`.

## Ursache
Die öffentlichen Catering-Seiten lesen über `src/hooks/useCateringMenus.ts`:
1. Zuerst aus `src/data/static-menus.json` (wird nur beim Build via `scripts/fetch-menu-data.ts` neu erzeugt).
2. Diese statischen Daten werden React Query als `initialData` übergeben — dadurch gelten sie als „frisch" und es wird **kein** Refetch aus der Datenbank ausgelöst, solange `staleTime` (5 Min.) nicht abgelaufen ist.

Ergebnis: Besucher sieht die alten Items aus dem letzten Build, obwohl die neuen längst im CMS / der Datenbank stehen.

## Lösung
SSG-Vorteil behalten (sofort sichtbarer Inhalt für SEO, kein leerer Screen), aber **direkt beim Mount** frische Daten aus der Datenbank nachladen.

### Änderung in `src/hooks/useCateringMenus.ts`
Bei den zwei öffentlichen Hooks `usePublishedCateringMenus` und `useCateringMenuBySlug`:
- `initialDataUpdatedAt: 0` ergänzen → React Query betrachtet die statischen Daten als veraltet und triggert sofort einen Hintergrund-Refetch.
- `refetchOnMount: "always"` setzen.
- `staleTime` auf `0` reduzieren.

Admin-Hooks und Mutationen bleiben unverändert.

### Verhalten danach
1. Seite öffnet → statische JSON wird sofort gerendert (SEO, kein Flicker).
2. Innerhalb ~300 ms zieht React Query die aktuellen Menü-Items aus der Datenbank.
3. Neue Gerichte und Fotos erscheinen sofort, ohne Deploy oder Reload.

## Betroffene Dateien
- `src/hooks/useCateringMenus.ts`

## Test
Neues Item in Maestro unter Fingerfood anlegen → `/catering/buffet-fingerfood` öffnen → Item ist nach ~1 Sekunde sichtbar.
