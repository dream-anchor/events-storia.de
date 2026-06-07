## Problem

Wenn eine Anzahlung über Stripe bezahlt wurde und die Restzahlung auch über Stripe läuft, zeigt die `PublicPaymentSection` im Public Offer aktuell den **gespeicherten Restbetrag** (`v2_payments.amount_cents` für `payment_type='final'`) — ohne sichtbaren Abzug der Anzahlung. Beispiel: Gesamt 1.500 €, Anzahlung 100 € → "Restzahlung 1.500 €" statt 1.400 €.

Ursachen:
- `final.amount_cents` wird im AddPaymentDrawer manuell eingegeben (Quick-Pick "Rest" zieht zwar ab, aber Operator kann auch z. B. den vollen Betrag setzen).
- Nachträglich bezahlte Anzahlungen (Stripe-Webhook) aktualisieren `final.amount_cents` nicht.
- UI rechnet nichts, sondern rendert die rohe Zahl aus `v2_payments`.

Die Restzahlungs-Landingpage (`/restzahlung/...`) zieht die Anzahlung bereits live ab. Die Inkonsistenz besteht ausschließlich in der Public-Offer-Anzeige.

## Fix in zwei Ebenen

### 1. Anzeige im Public Offer (sofort sichtbar, ohne DB-Migration)

`src/pages/PublicOffer.tsx` → `PublicPaymentSection`:

Pro `final`-Zeile zusätzlich eine kleine, dezente Aufschlüsselung rendern, **wenn** mindestens eine `deposit`/`prepayment` mit `status='paid'` existiert:

```
Restzahlung
  1.500,00 € − 100,00 € Anzahlung  = 1.400,00 €
```

Logik:
- `totalGross = inquiry.amount_total` (Maestro single source of truth, 1:1).
- `paidDeposits = Σ amount_cents WHERE payment_type IN ('deposit','prepayment') AND status='paid'`.
- `netFinal = totalGross − paidDeposits`.
- Anzeige des `final`-Rows: Hauptbetrag = `netFinal`; darunter Mini-Zeile "abzgl. Anzahlung 100 €".
- Falls `final.amount_cents !== netFinal`: trotzdem `netFinal` anzeigen (UI ist die Wahrheit gegenüber dem Kunden, Maestro-Regel: Anzahlung wird transparent abgezogen).

Mehrsprachig via vorhandenen `tOffer(lang, …)`-Keys: neuer Key `paymentsDepositDeducted` (DE/EN/IT/FR) im `i18n.ts`.

### 2. Datenebene konsistent halten (Operator-UX)

`src/components/admin/refine/InquiryEditor/AddPaymentDrawer.tsx`:

- Wenn `paymentType === 'final'` ausgewählt wird, Default-Wert von `amountInput` automatisch auf `total − Σ bereits bezahlte Anzahlungen` setzen (heute existiert das nur als manueller "Rest"-Quick-Pick).
- Bei jedem Öffnen des Drawers neu berechnen, damit nachträglich eingegangene Anzahlungen automatisch berücksichtigt werden.

Optional (in dieser Iteration **nicht** im Scope, nur dokumentiert):
- `handle-stripe-webhook` könnte beim Eingang einer Anzahlung eine vorhandene `final`-Draft-Zeile auf den neuen Netto-Betrag aktualisieren. Riskant wegen Edge-Cases (Mehrfach-Anzahlungen, Teilstornos) — bewusst aus diesem PR ausgeklammert.

## Nicht im Scope

- LexOffice-Schlussrechnung: dort funktioniert der Anzahlungs-Abzug bereits korrekt (`create-lexoffice-final-invoice` baut `downPaymentDeductions` automatisch).
- Restzahlungs-Landingpage (`/restzahlung`): rechnet schon korrekt.
- DB-Migrationen / Trigger: nicht nötig, Maestro bleibt single source of truth.

## Erwartetes Ergebnis

Public Offer zeigt bei einer 1.500-€-Buchung mit 100-€-Anzahlung:

```
Anzahlung    100,00 €  ✓ Eingegangen
Restzahlung  1.400,00 €
             (1.500,00 € − 100,00 € Anzahlung)
[Restzahlung jetzt bezahlen →]
```

Konsistent mit Restzahlungs-Landingpage, LexOffice-Schlussrechnung und Maestro-Total.
