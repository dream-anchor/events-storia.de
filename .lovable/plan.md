## Problem

Checkout schlägt mit `column "desired_time" is of type time without time zone but expression is of type text` fehl. Kunden können keine Catering-Bestellung absenden.

## Ursache

Die RPC-Funktion `public.checkout_create_catering_order(payload jsonb)` schreibt `desired_time` (Spaltentyp `time`) als plain text in das `INSERT`:

```sql
payload->>'desired_time',
```

Postgres akzeptierte das früher per impliziter Coercion, tut es jetzt aber nicht mehr (wahrscheinlich nach einem Plattform-Update). `desired_date` ist bereits korrekt mit `NULLIF(... ,'')::date` gecastet — `desired_time` fehlt das analoge `::time`.

Frontend-Code (`src/pages/Checkout.tsx`) ist korrekt und wird nicht angefasst — es ist ein reiner DB-Function-Bug.

## Fix (1 Migration, keine Code-Änderung)

Funktion `checkout_create_catering_order` ersetzen — identisch zur aktuellen Version, nur eine Zeile geändert:

```sql
-- vorher
payload->>'desired_time',
-- nachher
NULLIF(payload->>'desired_time','')::time,
```

`SECURITY DEFINER`, `search_path = public` und alle anderen Felder bleiben unverändert.

## Validierung

1. Migration deployen.
2. Testbestellung Pickup mit Uhrzeit → erfolgreich.
3. Testbestellung ohne Uhrzeit (`time = ""`) → `NULL` in DB, kein Fehler.
4. STORIA-Alert-Mail (`notify-checkout-error`) sollte für neue Submits ausbleiben.

Keine Änderungen an Edge Functions, Stripe-Flow, Frontend oder anderen Tabellen.