## Ziel

Alle Werte aus dem Maestro-Block „Zahlungs-Konditionen" (Methoden, Prozente, Fristen) müssen 1:1 auf jede LexOffice-Rechnung & jedes Angebot durchschlagen. Wenn Admin „Restzahlung-Frist (vor Event)" auf **1 Tag** ändert, muss auf der Rechnung exakt **„1 Tag vor der Veranstaltung"** stehen — und analog für alle anderen Felder, Methoden und Kunden.

## Status Quo (Analyse)

In `supabase/functions/create-event-quotation/index.ts` werden bereits gelesen:
- `inq.deposit_method`, `inq.balance_method`
- `inq.deposit_percent`, `inq.deposit_amount`, `inq.deposit_due_days`
- `inq.balance_due_days_before_event`
- `inq.invoice_due_days`, `inq.offer_validity_days`

Maestro (`PaymentTermsBlock.tsx`) persistiert genau diese Felder direkt auf `v2_events`. Die Datenkette stimmt also bereits — nur der Text-Builder hat Lücken.

## Lücken im Rechnungs-Text (Branch `isInvoiceMode && isFinalInvoice`)

1. **Keine Pluralisierung:** `1 Tage` / `1 Tagen` statt `1 Tag`.
2. **`invoice_after` (Rechnung nach Event)** fällt durchs Raster: `balance_due_days_before_event` ist null → es wird fälschlich `invoiceDueDays` als „Tage vor der Veranstaltung" formuliert. Korrekt ist „Zahlungsziel **X Tage nach Rechnungseingang**".
3. **`invoice_before`** wird wie generisch behandelt — Methodentext „per Überweisung" ist OK, aber der Satz sollte „Restzahlung per Rechnung vor Event — fällig X Tag(e) vor der Veranstaltung" lauten (klare Methodentrennung).
4. **`on_site`** ist bereits korrekt (im letzten Fix erledigt).
5. **Anzahlung:** Wenn `deposit_method = invoice` → derzeit `vor Ort (Bar / EC)`-Label fehlt korrekt, aber Frist nur sinnvoll bei `stripe`/`invoice` (vor Event). Bei `on_site` keine Frist (bereits erledigt).

Im Angebots-Pfad (`buildOfferRemark`) gilt das gleiche Pluralisierungs-Problem.

## Fix (nur Edge Function)

**Datei:** `supabase/functions/create-event-quotation/index.ts`

### A. Helper `daysLabel(n)`
```
const daysLabel = (n: number) => n === 1 ? '1 Tag' : `${n} Tage`;
```
Überall verwenden, wo bisher `${x} Tage` hardcoded ist (sowohl `buildOfferRemark` als auch `isInvoiceMode`-Branch und `buildPaymentConditions`).

### B. `isInvoiceMode && isFinalInvoice` — Restzahlungs-Phrase nach Methode auffächern

```text
balanceMethod === 'on_site' / 'cash' / 'card_onsite' / 'onsite'
  → "Restzahlung vor Ort beim Event (Bar / EC)"                       (bestehend)

balanceMethod === 'stripe_prepay' / 'stripe' / 'stripe_now'
  → "Restzahlung per Stripe (Online-Zahlung) — fällig {daysLabel(bDays)} vor der Veranstaltung"

balanceMethod === 'invoice_before'
  → "Restzahlung per Überweisung — fällig {daysLabel(bDays)} vor der Veranstaltung"

balanceMethod === 'invoice_after'
  → "Restzahlung per Überweisung — Zahlungsziel {daysLabel(invoiceDueDays)} nach Rechnungseingang"

Default / null
  → "Restzahlung fällig {daysLabel(bDays)} vor der Veranstaltung"
```

`bDays = balance_due_days_before_event ?? invoice_due_days` (bestehend).

### C. Anzahlungs-Phrase (`depInfo`)
```text
on_site         → "Anzahlung {betrag} vor Ort"
stripe          → "Anzahlung {betrag} per Stripe (Online-Zahlung) — innerhalb {daysLabel(dd)}"
invoice (vorab) → "Anzahlung {betrag} per Überweisung — innerhalb {daysLabel(dd)}"
none / 0%       → entfällt
```
`{betrag}` = `fixedDepositAmount.toFixed(2) €` falls > 0, sonst `depositPercent %`.

### D. `paymentConditions.paymentTermLabel`
- Wenn `on_site` für Restzahlung → unverändert `"Restzahlung vor Ort beim Event (Bar / EC)"`, `paymentTermDuration = 1` (Pflichtfeld LexOffice).
- Sonst spiegelt `paymentTermLabel` denselben Phrasenbaukasten wie in B.
- `paymentTermDuration` = `bDays` (oder `invoiceDueDays` bei `invoice_after`).

### E. `buildOfferRemark` (Angebots-PDF)
Selbe Behandlung von Pluralisierung über `daysLabel` und gleiche Methodenphrasen für Konsistenz zwischen Angebot und Rechnung.

### F. Edge Function deployen.

## Sanity-Checks (Beispiele nach Fix)

| Maestro-Setup | Resultierender Rechnungs-Remark |
|---|---|
| Anzahlung 20 % Stripe / Rest Stripe **1 Tag** | `Anzahlung 20% per Stripe (Online-Zahlung) — innerhalb 5 Tage, Restbetrag per Stripe (Online-Zahlung) — fällig 1 Tag vor der Veranstaltung. Vielen Dank für Ihre Buchung.` |
| Anzahlung Vor Ort 20 % / Rest Vor Ort beim Event | `Anzahlung 20% vor Ort, Restbetrag vor Ort beim Event (Bar / EC). Vielen Dank für Ihre Buchung.` |
| Keine Anzahlung / Rechnung nach Event 7 Tage | `Restzahlung per Überweisung — Zahlungsziel 7 Tage nach Rechnungseingang. Vielen Dank für Ihre Buchung.` |
| Anzahlung 30 % invoice / Rest Rechnung vor Event 14 Tage | `Anzahlung 30% per Überweisung — innerhalb 5 Tage, Restbetrag per Überweisung — fällig 14 Tage vor der Veranstaltung. Vielen Dank für Ihre Buchung.` |

## Nicht-Ziele
- Keine DB-Migration, kein Frontend-Code.
- Bestehende, bereits versendete Rechnungen werden **nicht** rückwirkend geändert.
- Keine Änderung an site-weiten Defaults — die werden nur gezogen, wenn Maestro selbst nichts gesetzt hat.
