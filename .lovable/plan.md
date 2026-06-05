## Befund

In `src/components/admin/refine/InquiryEditor/OfferBuilder/PriceBreakdown.tsx` gibt es zwei Render-Zweige:

- **Paket-Modus** (Zeile 551): `{onDiscountChange && (<DiscountInput .../>)}` → Button ist **immer** sichtbar, sobald die Komponente einen Discount-Handler bekommt. ✅
- **Menü-Modus** (Zeile 361): `{((discountPercentProp ?? 0) > 0 || (discountAmountProp ?? 0) > 0) && (<DiscountInput .../>)}` → Button erscheint **erst nachdem** schon ein Rabatt > 0 gesetzt ist. ❌

Daher fehlt der Rabatt-Toggle bei allen Menüs (Menü-Komposition) sowie überall dort, wo nur `discountPercent`/`discountAmount` als 0 reinkommt. Bei Paketen, E-Mail-Modus und Optionen erscheint er.

## Änderung

In `PriceBreakdown.tsx`, Zeile 361, die Sichtbarkeits-Bedingung angleichen an den Paket-Zweig:

```tsx
{onDiscountChange && (
  <div className="flex items-center justify-between text-xs">
    <DiscountInput ... />
    {discountAmountTotal > 0 && (
      <span>−{formatCurrency(discountDisplay)}</span>
    )}
  </div>
)}
```

Damit wird der Button bei jedem Menü, Paket, E-Mail-Modus und jeder Option sofort sichtbar und klickbar, unabhängig davon, ob bereits ein Rabatt gesetzt ist. Der `−€X`-Text und die "Netto"-Zeile bleiben weiterhin nur sichtbar, wenn `discountAmountTotal > 0`.

## Nicht enthalten

- Keine Logik-/Preisänderung (Maestro bleibt Single Source of Truth).
- Keine Default-Rabatte.
- Farbthema (`tone="green"`) bleibt unverändert in diesem Schritt — separat adressierbar, wenn gewünscht.
