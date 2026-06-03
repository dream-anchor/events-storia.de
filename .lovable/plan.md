# Fix: Endrechnung kann nicht erzeugt werden

## Diagnose

Die Anfrage `a14872bb…` hat **eine aktive** Angebots-Option:
- `offer_mode = 'full_menu'`
- `is_active = true`, `total_amount = 1135,50 €`, `guest_count = 25`
- `selected_quantity = NULL` (für eigene Menüs nicht gesetzt — gilt nur im Paket-Radio-Modus)

`create-lexoffice-final-invoice` ruft `create-event-quotation` mit `useSelectedQuantity: true` auf. Dort filtert:

```ts
workingOptions = workingOptions.filter(
  (o) => (o.selected_quantity ?? 0) > 0,
);
```

Da `selected_quantity` bei `full_menu` (und text-only / Einzel-Optionen) `NULL` ist, wird die einzige Option herausgefiltert → `workingOptions.length === 0` → Fehler **"Keine aktiven Angebots-Optionen gefunden"**.

`useSelectedQuantity` ist nur für den Paket-Radio-Modus relevant, in dem mehrere Optionen mit unterschiedlichen Stückzahlen koexistieren. Für `full_menu` / `email` / Einzeloptionen muss `NULL` als „voll gewählt" gelten (Menge = `guest_count`).

## Fix

`supabase/functions/create-event-quotation/index.ts` (Zeilen 762–766) — Filter so anpassen, dass nur explizite `0`-Mengen ausgeschlossen werden, `NULL` aber durchgelassen wird (Single-Option/Menü-Modus):

```ts
if (useSelectedQuantity) {
  workingOptions = workingOptions.filter((o) => {
    // NULL = keine Auswahlmenge nötig (full_menu, email, Einzeloption) → behalten
    // 0    = explizit abgewählt im Paket-Radio-Modus → entfernen
    return o.selected_quantity === null || o.selected_quantity === undefined || o.selected_quantity > 0;
  });
}
```

## Validierung

1. Edge Function neu deployen.
2. In Anfrage `a14872bb…` „Endrechnung jetzt erzeugen" klicken → Rechnung wird in LexOffice angelegt, Vorschau lädt.
3. Gegencheck Paket-Radio-Modus: Anfrage mit mehreren Paket-Optionen, eine mit `selected_quantity = 0` → diese Option fließt korrekt **nicht** in die Rechnung ein.

Keine weiteren Dateien betroffen.
