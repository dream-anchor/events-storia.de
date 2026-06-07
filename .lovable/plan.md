## Maestro: Anzahlung sichtbar von Restzahlung abziehen

Spiegelt die bereits im Public Offer aktive Logik in die Admin-`PaymentCard`.

### Änderungen in `src/components/admin/refine/InquiryEditor/PaymentCard.tsx`

1. **`offerTotal` und `paidDepositCents` an `PaymentRow` durchreichen**
   - `paidDepositCents = Σ amount_cents WHERE payment_type IN ('deposit','prepayment') AND status='paid'`
   - `totalCents = offerTotal * 100`

2. **In `PaymentRow` für `payment_type === 'final'`**
   - Wenn `totalCents > 0` und `paidDepositCents > 0`:
     - Hauptbetrag (Zeile 227) zeigt **Netto** = `totalCents − paidDepositCents`
     - Darunter dezente Sekundärzeile: `1.500,00 € − 100,00 € abzgl. Anzahlung`
   - Wenn `final.amount_cents` vom Netto-Wert abweicht: kleines Warn-Icon mit Tooltip „Gespeichert: X € — wird im Public Offer als Y € angezeigt" + Button **„Auf Netto korrigieren"**, der `amount_cents` per Update auf den Netto-Wert setzt (1-Klick-Fix für Altdaten, lädt danach neu via `onRefresh`).

3. **Footer-Summen (`paidTotal` / `openTotal` / `grandTotal`)**
   - `paidTotal` bleibt = Σ paid.
   - `openTotal` für Final-Zeilen den Netto-Wert verwenden (statt rohem `amount_cents`).
   - `grandTotal = offerTotal` (Maestro single source of truth), Fallback auf `paidTotal + openTotal` wenn `offerTotal` fehlt.

### Nicht im Scope

- Stripe-Webhook-Re-Sync der Final-Zeile.
- DB-Migration / Trigger.
- Public Offer (bereits live).

### Ergebnis

Maestro und Public Offer zeigen identische Netto-Restzahlung mit transparenter Aufschlüsselung. Operator kann mit einem Klick ein veraltetes `final.amount_cents` auf den korrekten Netto-Wert ziehen.
