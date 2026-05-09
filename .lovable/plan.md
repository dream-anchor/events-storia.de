## Ziel

Das Rabatt-Feld in der Preisaufstellung soll — analog zur Anzahlung — zwischen **% und €** umschaltbar sein. Aktuell akzeptiert es nur Prozent.

## Aktueller Stand

- Datenmodell: `OfferBuilderOption.discountPercent: number` (in `types.ts` Zeile 115). Persistiert in `menu_selection.discountPercent`.
- UI: Input mit fixem `%` in `PriceBreakdown.tsx` (Menü-Modus Zeile 248–275, Paket-Modus Zeile 437–464).
- Berechnung in `useOfferBuilder.ts` (Zeile 665, 707, 718): `discountFactor = 1 - discountPercent/100`, wirkt auf Subtotal/Total.
- Anzahlung verwendet bereits Pattern aus `PaymentTermsBlock.tsx` (Zeile 120, 144, 230–246): zwei Felder (`depositPercent` + `depositAmount`), Toggle leitet aus `amount > 0` ab.

## Lösung — gleiches Pattern wie Anzahlung

### 1. Datenmodell (`types.ts`)
- Neues Feld: `discountAmount: number` (€-Betrag, default 0).
- Bestehendes `discountPercent` bleibt.
- Hydration in `useOfferBuilder.ts` Zeile 442 ergänzen: `discountAmount` aus `menu_selection` lesen.
- Persistenz Zeile 191: `discountAmount` mitspeichern.
- Versendete Angebote: bleiben unverändert (kein Migration). Alte Angebote ohne `discountAmount` rendern korrekt (= 0 → Prozent-Modus).

### 2. Berechnung (`useOfferBuilder.ts`)
Helper `getDiscountAmount(opt, baseTotal)`:
- Wenn `discountAmount > 0` → return `min(discountAmount, baseTotal)` (€-Modus, deckelt auf 100%).
- Sonst → return `baseTotal × discountPercent / 100`.

Anwenden an drei Stellen:
- Menü-Modus (Zeile 665): `netPerPerson = subtotal − getDiscountAmount(opt, subtotal × guests) / guests`. (€-Rabatt wird auf Total angewandt, daher Division durch guestCount für die Pro-Person-Sicht.)
- Paket-Modus mit Override (Zeile 718): `newTotal = newTotal − getDiscountAmount(opt, newTotal)`.
- Paket-Modus ohne Override (Zeile 723): analog.

Cache-Key (Zeile 757) erweitern um `discountAmount`.

### 3. UI (`PriceBreakdown.tsx`)
Im Rabatt-Block (beide Branches: Menü + Paket):
- Modus aus props ableiten: `discountMode = (discountAmount ?? 0) > 0 ? 'amount' : 'percent'`.
- Toggle-Pill `% | €` (analog `PriceBreakdown.PricingModeToggle`, gleiche Optik wie Anzahlung).
- Input wertet je nach Modus `discountPercent` (0–100) oder `discountAmount` (€).
- Anzeige `−{formatCurrency(absoluteAmount)}` rechts bleibt gleich.
- Beim Modus-Wechsel: das nicht-aktive Feld auf `0` setzen (wie Anzahlung).

### 4. Props (`PriceBreakdown` Interface)
- Neu: `discountAmount?: number`, `onDiscountAmountChange?: (amount: number) => void`.
- `OptionCard.tsx` Zeile 407–408: beide Werte + Handler durchreichen.

## Was nicht geändert wird

- Datenbank-Schema (alles in `menu_selection` jsonb).
- Anschreiben/Cover-Letter-Prompt: bekommt €-Wert wie bisher (Endtotal ist korrekt).
- Versendete Angebote (immutable).
- Anderes Verhalten von Pakettypen, Override-Logik, etc.

## Smoke-Test

1. Paket-Modus, Override 1.000 €, Rabatt-Toggle auf `€`, Wert `100` → Netto 900 €.
2. Toggle auf `%`, Wert `10` → Netto 900 € (gleiches Ergebnis).
3. Menü-Modus, Subtotal/Pers. 50 €, 10 Gäste, Rabatt `€` 50 → Total 450 € (statt 500).
4. Bestehendes Angebot mit `discountPercent: 10` öffnen → zeigt `%`-Modus mit 10.
5. Rabatt 0 → kein Rabatt-Block sichtbar (heutiges Verhalten).

## Risiko

Gering. Reine Erweiterung (ein neues optionales jsonb-Feld), Toggle-Pattern existiert bereits 1:1 in der Anzahlung.
