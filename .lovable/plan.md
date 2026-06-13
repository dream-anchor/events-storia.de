## Problem

Im Public Offer zeigt die Angebotskarte „833 Gäste — 0,00 €" und kein Anzahlungs-/Restzahlungs-Button. Ursache: `option.total_amount = 0` in der DB. Summe und Rabatt stehen in `menu_selection.freeformProgram.totalsFromText.gross` bzw. `freeformProgram.discount` — werden aber für die Kostenkarte nicht herangezogen.

Da `totalAmount` als 0 berechnet wird, fallen auch alle abhängigen Anzeigen aus:
- Gesamtpreis (0,00 €)
- Anzahlungsbetrag (20 % aus 0)
- Restzahlungs-Hinweis
- Stripe-Buttons („Jetzt zahlen" / „Anzahlung")
- Zahlungs-Konditionen-Block (Fristen Anzahlung/Restzahlung gemäß Screenshot)

## Lösung

Eine zentrale Stelle in `src/pages/public-offer/ProposalView.tsx`: Helper `effectiveTotalFor(opt)`, der für Freeform-Optionen den Bruttobetrag aus dem Programm berechnet, wenn `total_amount` 0 ist.

```text
effective = opt.total_amount > 0
  ? opt.total_amount
  : (freeform ? max(0, totalsFromText.gross − discountAmount) : 0)
```

`discountAmount`:
- `mode==='amount'` → `value`
- `mode==='percent'` → `gross * value / 100`

Anwendung:
- `perPersonPriceFor(opt)` nutzt `effectiveTotalFor(opt)` statt `opt.total_amount`.
- `totalAmount` (Zeile 150–152) nutzt `effectiveTotalFor(selectedOption)`.

Dadurch greifen automatisch wieder:
- Anzeige „Gesamtpreis inkl. MwSt." mit korrektem Betrag.
- `depositAmount` Berechnung (20 % aus echtem Total bzw. fester Anzahlungs-Betrag).
- `showDeposit` und damit der gesamte Stripe-Block (Anzahlungs-/Vollzahlungs-Buttons).
- Bestehender Zahlungs-Konditionen-Hinweis (Anzahlung X %, Frist Y Tage, Restzahlung Z Tage vor Event), der bereits `paymentMethod`, `depositPercent`, `depositDueDays`, `invoiceDueDays` aus `inquiry` rendert.

Falls der Zahlungs-Konditionen-Hinweis (wie im Screenshot) im Public Offer aktuell nicht sichtbar gerendert wird, prüfen wir das im selben Patch und stellen sicher, dass er bei `totalAmount > 0` ausgegeben wird — Wording analog zum Editor-Hinweis: „Anzahlung 20 % per Stripe innerhalb 5 Tage, Restzahlung per Stripe (10 Tage vor Event). Angebot 14 Tage gültig."

## Datei

- `src/pages/public-offer/ProposalView.tsx` (einziger Patch).

Keine DB-Migrationen, keine Edge-Function-Änderungen.
