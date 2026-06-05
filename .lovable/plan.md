# LexOffice-Angebot: Zahlungs-Satz 1:1 aus dem Admin-Angebot

## Problem

Auf dem LexOffice-Angebots-PDF erscheint am Ende der hartcodierte Text:

> Anzahlung 20% innerhalb von 5 Tagen
> Restzahlung vor Veranstaltung. Dieses Angebot ist 14 Tage gültig.

Die ausgewählten Zahlungswege (Stripe, vor Ort, Rechnung) und das im Admin sichtbare Detail („… per Stripe …", „… (10 Tage vor Event)") werden ignoriert. Der erwartete Original-Satz aus dem Admin lautet z. B.:

> Anzahlung 20 % per Stripe innerhalb 5 Tage, Restzahlung per Stripe (10 Tage vor Event). Angebot 14 Tage gültig.

Die Quelle der Diskrepanz ist `buildRemarkText()` in `supabase/functions/create-event-quotation/index.ts` (Zeile 706–712) — sie kennt `deposit_method`, `balance_method` und `balance_due_days_before_event` nicht und nutzt sie nicht im Remark.

## Lösung

Im Edge Function `create-event-quotation` einen neuen Helper `buildOfferRemark()` einführen, der den Admin-Summary-Text 1:1 nachbaut (siehe `PaymentTermsBlock.tsx` Zeilen 165–180) und vom Quotation-Pfad statt `buildRemarkText()` aufgerufen wird.

Der Helper bekommt:
- `depositMethod` (`'none' | 'stripe' | 'on_site' | 'invoice'`)
- `balanceMethod` (`'stripe_prepay' | 'on_site' | 'invoice_before' | 'invoice_after'`)
- `depositPercent`, `depositAmount` (fix), `depositDueDays`
- `balanceDueDaysBeforeEvent`, `invoiceDueDays`
- `offerValidityDays`

Logik identisch zum UI:
- `depositText`:
  - `none` → kein Anzahlungs-Satz
  - sonst: Betrag (€ wenn `depositAmount > 0`, sonst `%`), Kanal (`per Stripe` / `vor Ort` / `per Rechnung`), Frist (`innerhalb {Tage} Tage` — nur bei Stripe oder Rechnung).
- `balanceText`:
  - `stripe_prepay` → `Restzahlung per Stripe ({bDays} Tage vor Event)`
  - `on_site` → `Restzahlung vor Ort beim Event`
  - `invoice_before` → `Restzahlung per Rechnung vor Event (Zahlung bis {bDays} Tage vor Event)`
  - `invoice_after` → `Restzahlung per Rechnung nach Event (Zahlungsziel {invDays} Tage)`
- Zusammensetzung: `"${depositText ? depositText + ', ' : ''}${balanceText}. Angebot ${ov} Tage gültig."`

Fallback (Legacy-Anfragen ohne `deposit_method`/`balance_method`): aus `payment_method` ableiten (gleiche Mapping-Tabelle wie `legacyToPair()` in `PaymentTermsBlock.tsx`).

`buildPaymentConditions()` bleibt unverändert (liefert `paymentTermLabel` und `paymentTermDuration` für das LexOffice-Pflichtfeld) — nur das `remark` wird durch den neuen Helper ersetzt. Invoice- und Final-Invoice-Pfade (Zeile 998–1021) bleiben unverändert.

## Technische Details

**Datei:** `supabase/functions/create-event-quotation/index.ts`

1. Neue Funktion `buildOfferRemark(args)` (~25 Zeilen) nahe `buildRemarkText()`.
2. Hilfsfunktion `legacyMethodPair(payment_method)` für den Fallback, identisch zu `legacyToPair()` im Frontend.
3. In Zeile 1024 `remarkText = buildRemarkText(...)` ersetzen durch:
   ```ts
   const pair = legacyMethodPair(paymentMethod);
   const dMethod = (depositMethod ?? pair.deposit) as 'none'|'stripe'|'on_site'|'invoice';
   const bMethod = (balanceMethod ?? pair.balance) as 'stripe_prepay'|'on_site'|'invoice_before'|'invoice_after';
   remarkText = buildOfferRemark({
     depositMethod: dMethod,
     balanceMethod: bMethod,
     depositPercent,
     depositAmount: fixedDepositAmount,
     depositDueDays,
     balanceDueDaysBeforeEvent: balanceDueDaysBeforeEvent ?? 10,
     invoiceDueDays,
     offerValidityDays,
   });
   ```
4. `create-event-quotation` neu deployen.

Kein Frontend-Change, keine Migration, keine LexOffice-API-Änderung.
