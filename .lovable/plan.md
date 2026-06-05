## Ziel
Beim Klick auf eine Kategorie, einen Tag oder beim Tippen in der Suche soll sofort sichtbar sein, dass das Album noch lädt/filtert – damit klar ist, ob die aktuelle Ansicht final ist.

## Problem heute
`usePhotoAlbum` triggert bei jedem Filterwechsel eine neue Query (neuer `queryKey`). Während `isFetching` zeigt die UI aber weiterhin die alte Galerie ohne Indikator. `isLoading` ist nur beim allerersten Laden true – deshalb wirkt es, als wäre nichts passiert.

## Änderungen (nur Frontend, `src/pages/admin/Fotoalbum.tsx`)

1. **`isFetching` aus dem Hook nutzen** (zusätzlich zu `isLoading`).
2. **Aktiver Filter-Badge zeigt Spinner**, solange `isFetching` läuft – kleines `Loader2`-Icon (animate-spin) im aktuell selektierten Kategorie-Badge und Tag-Badge.
3. **Dezenter Top-Indikator** über der Galerie: schmaler Hinweis „Lade Fotos …" mit `Loader2`, wenn `isFetching && !isLoading` (also bei Filterwechsel, nicht beim allerersten Mount, da dort schon der große Spinner kommt).
4. **Galerie leicht ausgegraut** (`opacity-60 transition-opacity`) während `isFetching`, damit visuell klar wird: Ansicht ist noch nicht final.
5. **Ergebnis-Count** „X Fotos" neben den Filtern – sobald die Query fertig ist, springt die Zahl auf den neuen Wert (zusätzliches Finalitäts-Signal).

Keine Änderungen an Query-Logik, Edge Functions oder Datenbank.
