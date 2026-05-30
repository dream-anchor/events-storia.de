## Problem

In der Command-Palette (⌘K) wird beim Tippen von "ess" nicht die Firma "ESS" als Bestellung angezeigt, sondern nur Navigationspunkte wie "Catering-Bestellungen" (matched auf "Bestellungen"), "Speisen & Getränke" (Speisen) etc.

Ursache: `cmdk` filtert standardmäßig clientseitig nach den Labels der gerenderten Items. Die dynamisch via `useList` geladenen Treffer aus `event_inquiries` und `catering_orders` werden zwar geladen — aber `cmdk` schließt sie aus, weil deren sichtbarer Text (z. B. "ESS GmbH · 12.06.25") nicht clean auf "ess" matched, während gleichzeitig die Navigations-Items "fälschlich" matchen.

Zusätzlich werden echte Suchergebnisse unter die Navigation gemischt, statt prominent oben zu stehen.

## Lösung

`src/components/admin/refine/CommandPalette.tsx` umbauen:

1. **`shouldFilter={false}`** am `CommandDialog` setzen — wir filtern serverseitig (Supabase `contains`-Filter läuft bereits) und übernehmen die Anzeige-Logik selbst.

2. **Reihenfolge bei aktiver Suche (`search.length >= 2`):**
   - Ganz oben: **Treffer** (Event-Anfragen + Catering-Bestellungen), inkl. Loading-State (`isFetching`) und "Keine Treffer für ‚ess'"-Hinweis, wenn beide Listen leer sind.
   - Darunter optional: gefilterte Navigation/Schnellaktionen, aber nur die, deren Label tatsächlich den Suchbegriff enthält (manueller `includes`-Check, case-insensitive). So verschwinden irreführende Treffer wie "Catering-Bestellungen" bei "ess" nicht komplett, sind aber klar nachrangig.

3. **Bei leerer Suche** (`search.length < 2`): unverändert Navigation + Schnellaktionen + Extern anzeigen.

4. **Treffer-Darstellung leicht aufwerten:**
   - Event-Anfragen: Firma/Name groß, darunter Datum + Gäste + Status — Label hilfreicher machen (z. B. "ESS GmbH" deutlich, E-Mail als sekundäre Zeile, damit man die Anfrage sofort einordnen kann).
   - Catering-Bestellungen: Kunde/Firma + Bestellnummer + Datum + Betrag (bereits vorhanden, bleibt).
   - Beide bekommen ein klares Badge ("Anfrage" bzw. "Bestellung"), damit sofort erkennbar ist, in welcher Sektion man landet.

5. **Suche entlatencen:** `search` per kleinem `useDebouncedValue` (150 ms) durchreichen, damit nicht bei jedem Tastendruck zwei Supabase-Queries feuern.

6. **Empty-State** der `CommandEmpty` nur noch zeigen, wenn weder dynamische Treffer noch gefilterte Navigation übrig sind.

## Out of scope

- Keine Änderung an Datenmodell, Edge Functions oder anderen Seiten.
- Suche bleibt auf `event_inquiries` + `catering_orders` beschränkt (keine neuen Ressourcen wie `event_bookings`/Pakete in dieser Iteration).
- Keyboard-Shortcuts (⌘O, ⌘M …) bleiben unverändert.

## Technische Details

- Datei: `src/components/admin/refine/CommandPalette.tsx`
- `CommandDialog` Prop `shouldFilter={false}` (cmdk-API).
- Kleiner `useDebouncedValue`-Hook lokal in der Datei.
- Navigations-Array in ein konstantes Array hochziehen, damit ein einziger `.filter(item => item.label.toLowerCase().includes(q))` reicht.
- Loading-Spinner: kleines `Loader2`-Icon (lucide) in einem CommandItem mit `disabled`, wenn `recentEventsQuery.isFetching || recentOrdersQuery.isFetching`.
