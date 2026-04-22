

# Mengen-Stepper im PublicOffer: korrektes "Verbleibend" + Max-Cap

## Befund

1. **Falsche „Verbleibend"-Anzeige (Screenshot 3):**
   `remainingGuests` wird in `PublicOffer.tsx` Zeile 869–872 berechnet als
   `targetGuests - totalQuantity + (eigene Quantity)`.
   Dadurch wird die eigene Menge der Karte **wieder zur Restmenge addiert**. Bei 3/10 zeigt die Karte „noch 10 von 10 zu verteilen" statt korrekt „noch 7 von 10".

2. **Kein Max-Cap (Screenshot 1):**
   Der `+`-Button und das Input-Feld lassen beliebige Werte zu — Kunde kann 11 Gäste auf 10 verteilen, obwohl die Anfrage 10 Personen umfasst.

## Lösung

Beide Fixes in `src/pages/PublicOffer.tsx`. Reine Frontend-Änderung, ~10 Zeilen Diff.

### Fix 1 — Korrekte Restmenge

Zeile 869–872: die eigene Quantity **nicht** mehr addieren.

```ts
remainingGuests={
  targetGuests !== null
    ? Math.max(0, targetGuests - totalQuantity)
    : null
}
```

So zeigt jede Karte konsistent dieselbe globale Restmenge — bei Summe = 3 von 10 sehen alle Karten „noch 7 von 10 zu verteilen".

### Fix 2 — Max-Cap auf Stepper

Pro Card berechnen: `maxForThisOption = targetGuests !== null ? quantity + remainingGuests : Infinity`.
Das entspricht „aktuelle Menge + globale Restmenge" → Erhöhen ist nur möglich, solange globale Summe ≤ Ziel.

- `+`-Button: `disabled={targetGuests !== null && remainingGuests === 0}` und `onClick` nutzt `Math.min(maxForThisOption, quantity + 1)`
- `Input`: `max={maxForThisOption}` und `onChange` clamped auf `Math.min(maxForThisOption, n)`
- `pricingMode === 'per_event'`: Max bleibt 1 (wie bisher implizit), kein Cap-Konflikt

### Edge Cases

- `targetGuests === null` (z.B. `guest_count` nicht parsebar, leer): kein Cap, wie bisher freie Eingabe
- Single-Option: Stepper bleibt komplett ausgeblendet (unverändert)
- `remainingGuests > target` (Eingabe via Tastatur): wird abgefangen durch Clamp im `onChange`

## Geänderte Dateien

- `src/pages/PublicOffer.tsx` — `remainingGuests`-Formel + Stepper-Cap (`disabled`-Prop, `max`-Attr, Clamp in `onChange` und `+`-Klick). ~10 Zeilen Diff, keine Props-Änderungen, keine neuen Komponenten.

## Verifikation

1. Multi-Option, `guest_count='10'`, alle Karten leer → alle zeigen „noch 10 von 10".
2. Karte A auf 3 setzen → A zeigt „noch 7 von 10", B/C/D zeigen ebenfalls „noch 7 von 10".
3. Karte B auf 7 setzen → Summe = 10 → alle Karten: `+`-Button disabled, Hint „✓ Alle 10 Gäste verteilt" oben.
4. Versuch, Karte C auf 1 zu setzen → Input clamped auf 0 (Rest = 0).
5. `guest_count` leer/unparsebar → keine Restanzeige, keine Caps (Free-Mode wie bisher).

