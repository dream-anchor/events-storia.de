# Plan: KI-Vorschlag-Button feuert nicht — Diagnose + Fix

## Symptom
Klick auf „3 Menü-Varianten mit KI" zeigt weder Toast noch Edge-Function-Call (Netzwerk + Edge-Function-Logs leer). Im UI passiert nichts.

## Wahrscheinliche Ursachen (priorisiert)
1. **Stale-Closure-Problem im Handler**: `handleGenerateMenuSuggestion` ist mit `builder.options` in den useCallback-Deps verdrahtet. Nach dem ersten `builder.updateOption(...)` ändert sich `builder.options`, der Handler wird neu erstellt — aber die laufende async-Funktion arbeitet mit dem alten Snapshot weiter. Beim 2. & 3. Variant-Iterationsschritt lookup über `builder.options[options.length-1]` nach `addOption()` greift dann auf das alte Array zu und überschreibt evtl. dieselbe Option oder nichts. Im Screenshot existiert nur Option A — beim ersten Variant müsste sie aber sofort befüllt werden, was sie nicht ist → Hinweis: vermutlich greift schon der ERSTE `updateOption` nicht (z. B. weil `target.id` aus stale options gegen die aktuellen options im Hook nicht matched, oder der Handler bricht früher ab).
2. **`builder.options` evtl. erst nach `addOption()` verfügbar**: useOfferBuilder erstellt im Hintergrund neue IDs, der Re-Lookup `options[length-1]` bekommt evtl. nichts (undefined) und der Handler bricht still ab.
3. **Promise-Chain wirft still**: Wenn `supabase.functions.invoke` einen Network-Error wirft, fängt der `catch` zwar, schreibt aber nur `console.error` — und im Console-Log-Suchfilter taucht es nicht auf, wenn die Console wirklich leer ist.

## Diagnose-Strategie
- Diagnostische `console.log`-Marker an drei Punkten setzen, damit beim nächsten Klick eindeutig sichtbar ist, wo es klemmt:
  1. Direkt am Start von `handleGenerateMenuSuggestion` → bestätigt, dass der Click ankommt.
  2. Direkt vor und nach `supabase.functions.invoke(...)` → bestätigt, ob die Edge Function aufgerufen wird und was sie zurückgibt.
  3. Vor jedem `builder.updateOption(...)` mit `target.id`, `target.optionLabel` und der Variante.

## Fix-Strategie (parallel zur Diagnose)
Den Handler so umbauen, dass er nicht von `builder.options` als Live-State abhängt:

1. **Direkt zu Beginn einen Snapshot der freien Options ziehen** (`const free = builder.options.filter(isEmpty)`).
2. **Bei Bedarf vor der Variant-Schleife** so viele leere Optionen wie nötig per `addOption()` anlegen (sequenziell mit await zwischen den `addOption`-Aufrufen) und sich dabei die neu vergebenen IDs aus einer **Rückgabe** holen.
   - Dafür muss `useOfferBuilder.addOption` so erweitert werden, dass es die ID der neu angelegten Option zurückgibt (aktuell vermutlich void). Falls Anpassung im Hook nicht trivial: alternativ Snapshot der vorhandenen IDs vor `addOption`, dann nach kurzer Pause `builder.options` (aus Ref!) erneut lesen und die neue ID (= IDs außerhalb des alten Sets) extrahieren — das gleiche Problem wie jetzt, daher Hook-Anpassung bevorzugt.
3. **Erst danach** in einer einzigen synchronen Schleife alle 3 `updateOption`-Calls absetzen (alle Ziel-IDs sind dann bekannt und stabil).
4. Den `pointer-events`/`disabled`-Check sicherheitshalber gegen `isSignatureLocked` prüfen.

## Konkrete Schritte
- `useOfferBuilder.ts`: Signatur `addOption(mode?: OfferMode): string` — gibt die ID der neu angelegten Option zurück (Schritt im Hook trivial, weil `setOptions` schon eine neue Option mit `crypto.randomUUID()` baut).
- `OfferBuilder.tsx` `handleGenerateMenuSuggestion`:
  - Console-Marker (s. o.)
  - Vor der Schleife: Ziele bestimmen (free + neu angelegt), Liste von Ziel-IDs `targetIds: string[]` mit Länge = `variants.length`.
  - Schleife schreibt direkt per `targetIds[i]` (kein erneuter Lookup über `builder.options`).
  - Funktion bleibt resilient bei 4–5 belegten Optionen (Skip + Warnung wie bisher).

## Verifikation
Nach dem Fix: Klick → Edge-Function-Log zeigt Eingang, Network-Tab zeigt POST, Toast erscheint, alle 3 Varianten landen in Option A/B/C (oder den nächsten freien).

## Nicht angefasst
RequestContextBanner, Edge Function, Catering-Handler.
