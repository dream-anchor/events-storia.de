## Problem
Im LexOffice-PDF erscheinen aktuell zwei Zeilen direkt untereinander:

1. „Anzahlung 20% innerhalb von 5 Tagen" – automatisch generierter Standard-`paymentTermLabel`
2. „Anzahlung 20 % per Stripe innerhalb 5 Tage, Restzahlung per Stripe (10 Tage vor Event). Angebot 14 Tage gültig." – detaillierter `remark`

Beide Zeilen sagen im Kern dasselbe. Der erste Satz soll raus.

## Ursache
In `supabase/functions/create-event-quotation/index.ts` werden für Angebote (Nicht-Rechnungs-Modus) zwei getrennte Felder an LexOffice gesendet:

- `paymentConditions.paymentTermLabel` aus `buildPaymentConditions()` (Zeile 701) → erzeugt den generischen Satz
- `remark` aus `buildOfferRemark()` → der ausführliche, korrekt formulierte Satz mit Methode + Restzahlung + Gültigkeit

LexOffice rendert beide direkt untereinander im PDF.

## Fix
Im Quotation-Zweig (`else` ab Zeile 1126) den `paymentTermLabel` durch den bereits korrekten `remarkText` ersetzen, sodass nur noch eine Zeile im PDF erscheint:

```ts
} else {
  const baseConditions = buildPaymentConditions(depositPercent, depositDueDays, fixedDepositAmount);
  // ... remarkText wie bisher per buildOfferRemark berechnen ...
  paymentConditions = {
    paymentTermLabel: remarkText,             // ersetzt generischen Satz
    paymentTermDuration: baseConditions.paymentTermDuration,
  };
}
```

Und im `documentPayload` für Angebote `remark` weglassen (oder leeren), damit der Satz nicht doppelt erscheint. Für Rechnungs-Modi (`isInvoiceMode`) bleibt das Verhalten unverändert.

## Betroffene Dateien
- `supabase/functions/create-event-quotation/index.ts` (nur Quotation-Zweig, ~Zeile 1126–1164)

Keine Migration, keine UI-Änderung. Nach Deploy einmal „Vorschau anzeigen" klicken → PDF neu erzeugt mit nur noch einem Zahlungsbedingungs-Satz.
