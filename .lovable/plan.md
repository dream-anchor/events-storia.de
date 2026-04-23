

# Menü-Namen statt "Option A × 2" anzeigen — Frontend + Stripe

## Befund

Aktuell zeigen drei Stellen "Option A × 2" statt sprechende Menü-/Paket-Namen:

1. **Live-Summary** (`PublicOffer.tsx` Zeile 938): `Option ${o.option_label} × ${qty}`
2. **Submit-Notes** (Zeile 805): gleiche Formel landet im `customer_notes`-Feld
3. **Stripe-Checkout** (`create-payment-session/index.ts` Zeile 112 + 136): `descriptionParts.push('${opt.option_label} × ${quantity}')` → Stripe-Produkt-Description "A × 2 + B × 2 + C × 2"

Außerdem fehlt in der Stripe-Edge-Function `package_name` komplett im `select(...)` (Zeile 64) — der Name ist serverseitig nicht verfügbar.

## Lösung

### Helper-Funktion (Frontend)
In `PublicOffer.tsx` neue lokale Funktion (oder inline-Mapper):
```ts
const formatOptionLabel = (o: OfferOption) => {
  const isCustom = o.offer_mode === "menu" 
    || o.package_name === "Individuelles Paket" 
    || o.package_name === "Individuelles Menü";
  // Bei "Individuell" → bestehender Fallback (z.B. erster Gang oder "Menü A")
  return isCustom ? `Menü ${o.option_label}` : o.package_name;
};
```

(Dieselbe Logik existiert schon in Zeile 1229 + 1572 für die Option-Karten — wird nur extrahiert.)

### Anwendung

**Live-Summary (Zeile 935–940)** — neue Anzeige:
```
Tasting Menu Auriga × 2 · Business Lunch × 2 · Menü C × 2
```
Bei langen Namen: max. 1 Zeile mit Truncate (`truncate` auf der `<p>`), volle Liste optional als Tooltip.

**Submit-Notes (Zeile 803–806)** — gleicher Mapper:
```
Meine Aufteilung: Tasting Menu Auriga × 2, Business Lunch × 2, Menü C × 2 (6 Gäste)
```

**Stripe-Edge-Function**:
- `select(...)` um `package_name` erweitern (Zeile 64): `'id, inquiry_id, option_label, package_name, total_amount, ...'`
- `OptRow`-Type um `package_name: string | null` ergänzen (Zeile 75–80)
- `descriptionParts.push(...)` umstellen (Zeile 112):
  ```ts
  const displayName = opt.package_name?.trim() && 
    !['Individuelles Paket','Individuelles Menü'].includes(opt.package_name)
    ? opt.package_name : `Menü ${opt.option_label}`;
  descriptionParts.push(`${displayName} × ${quantity}`);
  ```
- Stripe-Produkt-Description wird dann z.B. `"Tasting Menu Auriga × 2 + Business Lunch × 2"` — sichtbar im Stripe-Checkout, in der Bestellbestätigung und in LexOffice.

### "Individuelles Menü"-Sonderfall

Bei Custom-Menüs gibt es keinen aussagekräftigen Paket-Namen. Fallback `Menü ${option_label}` ist semantisch besser als `Option A`, weil "Menü" das verkaufte Produkt benennt. Optional Phase 2: ersten Gang-Namen als Suffix anhängen (`Menü A · Tasting Burrata`) — derzeit nicht im Scope.

## Geänderte Dateien

- `src/pages/PublicOffer.tsx` — neuer Helper + 2 Anwendungsstellen (~10 Zeilen)
- `supabase/functions/create-payment-session/index.ts` — `package_name` in SELECT + Type + Description-Format (~6 Zeilen)

Keine DB-Migration. Kein Breaking-Change für bestehende Flows.

## Verifikation

1. **Frontend Live-Summary:** Optionen "Tasting Menu Auriga", "Business Lunch", Custom-Menü → Anzeige `Tasting Menu Auriga × 2 · Business Lunch × 2 · Menü C × 2`.
2. **Stripe-Checkout:** Zahlungsstart → Stripe-Seite zeigt Produkt-Description mit echten Menü-Namen statt `A × 2 + B × 2`.
3. **Submit-Notes:** Nach Buchung im Admin-Activity-Log: `Meine Aufteilung: Tasting Menu Auriga × 2, ... (6 Gäste)`.
4. **Custom-Menü:** Option ohne Paket → Fallback `Menü ${label}` (statt leerer String oder `undefined × 2`).
5. **Lange Namen:** Summary-Zeile bleibt einzeilig (truncate), Total bleibt rechts sichtbar.

