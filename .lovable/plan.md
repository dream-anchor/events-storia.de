## Ziel

Beim Freitext-Import sollen Speisen automatisch mit der Speisekarte (Ristorante + Catering) abgeglichen werden. Wird ein Match gefunden → **Original-Bezeichnung und Original-Preis aus der Datenbank** übernehmen. Kein Match → Name aus Text behalten, Preis bleibt 0 (leer).

## Geänderte Datei

Nur `supabase/functions/parse-freeform-offer/index.ts` — der Editor und die UI bleiben unverändert.

## Ablauf

```text
Freitext
  → KI extrahiert Programm (wie bisher)
  → NEU: Menu-Lookup pro Item (Server-seitig)
      - Fetch catering items (menu_items, lokale DB)
      - Fetch ristorante items (externe DB via vorhandener fetch-ristorante-menus Logik)
      - Normalisiere Namen (lowercase, ohne Sonderzeichen, ohne Mengenpräfix)
      - Match-Strategie:
          1. Exakte Namensgleichheit
          2. startsWith in beide Richtungen
          3. Token-Überlappung ≥ 80%
      - Bei mehreren Treffern: Ristorante vor Catering, Items mit Preis > 0 zuerst
  → Bei Match: item.name = DB.name, item.unitPriceNet = DB.price
  → Bei kein Match: name bleibt wörtlich, unitPriceNet bleibt 0
  → priceMode bleibt unverändert ('per_person' default)
  → Response wie bisher
```

## Technische Details

- Beide DBs (lokale Supabase + Ristorante) per `SUPABASE_*` und `RISTORANTE_SUPABASE_*` Env-Vars; Service-Role nur für lokale Items mit Felder `name, price` (deleted_at/archived_at IS NULL).
- Ristorante-Preis: `price` Fallback auf Parse von `price_display` (wie in `useCombinedMenuItems`).
- Match-Funktion liegt inline in der Edge-Function (keine neue Datei).
- Iteriert über `program.days[].meals[].sections[].items[]`.
- Maestro-Prinzip bleibt: keine Berechnung, nur 1:1-Übernahme aus DB.

## Validierung

- Build/typecheck grün.
- Edge-Function deployen, mit Beispieltext (Pizza Margherita, Insalata Mista) testen → Preise und exakte DB-Bezeichnungen erscheinen im Editor.
- Unbekanntes Item (z.B. "Fantasiegericht XYZ") → Name bleibt, Preis 0.
