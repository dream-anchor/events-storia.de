## Problem

Auf iOS Safari schlägt das Admin-Panel mit `Can't find variable: Temporal` fehl. Die Library `@schedule-x/calendar` (verwendet im Dashboard) referenziert das noch nicht in Safari verfügbare `Temporal` API.

Aktuell wird der Polyfill `@js-temporal/polyfill` nur in `DayTimelineSidebar.tsx` importiert. In der Praxis kann `@schedule-x/calendar` durch Vite-Code-Splitting / Modul-Preload aber bereits ausgewertet werden, bevor der Polyfill global registriert ist — daher der Crash, der den gesamten Admin-Bundle reißt (weiße Seite mit Fehlertext).

## Fix

Polyfill-Import an die allererste Stelle des App-Entrypoints ziehen, damit `globalThis.Temporal` garantiert gesetzt ist, bevor irgendein anderes Modul (insbesondere schedule-x) lädt.

### Änderungen

**`src/main.tsx`** — als erste Zeile vor allen anderen Imports:
```ts
import "@js-temporal/polyfill";
```

**`src/components/admin/refine/dashboard/DayTimelineSidebar.tsx`** — redundanten Polyfill-Import + Kommentar entfernen (wird zentral in `main.tsx` geladen).

## Verifikation

- Build durchlaufen lassen.
- Auf iOS Safari (Handy): `/admin` öffnen → Dashboard lädt ohne `Temporal`-Fehler, Tages-Timeline rendert.
- Desktop-Regression: Admin-Routen wie gewohnt erreichbar.

## Scope

Nur Frontend-Bootstrap. Keine Logik-, Daten- oder UI-Änderungen.