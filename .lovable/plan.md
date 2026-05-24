## Ziel

Zwei Themen sauber zu Ende ziehen:

1. **Bug: 0% Anzahlung wird als 20% angezeigt** (Public Offer + Berechnung).
2. **UI-Verkabelung Anzahlungs-/Schlussrechnung** (Backend ist da, Buttons & manuelle Trigger fehlen).

---

## Teil 1 — 0%-Anzahlung Bug fix (Senior CX + Red Team)

### Root Cause
Drei Ebenen treffen aufeinander:

- **Editor** (`PaymentTermsBlock.tsx`): Das `%`-Input hat `min={1}` und `handleNumber(... , 1, 99)` — **0 lässt sich gar nicht eingeben**. Es gibt auch keine Methode "keine Anzahlung". `deposit_online` ist die einzige Variante mit Anzahlungsfeld; bei `on_site`/`invoice_after` bleibt der Altwert stehen.
- **Public Offer**: `inquiry.deposit_percent ?? 20` an 3 Stellen (`PublicOffer.tsx:188`, `ProposalView.tsx:153`, `FinalOfferView.tsx:59`). Bei `null` in der DB ⇒ 20%.
- **computeDeposit** ignoriert `payment_method`. Wenn Admin auf `on_site`/`invoice_after` umstellt, wird Altwert (z.B. 20) weiter benutzt.

### Fixes

1. **`PaymentTermsBlock.tsx`**
   - `min={0}`, `handleNumber("deposit_percent", e.target.value, 0, 99)`.
   - Bei `deposit_percent === 0` Hinweistext anzeigen: "Keine Anzahlung — volle Zahlung zum Termin/per Rechnung."
   - In `handleMethodChange`: bei Wechsel auf `on_site`/`invoice_after` ⇒ `deposit_percent = 0`, `deposit_amount = 0` (klare DB-Wahrheit, kein Stale-State).
   - Default für Neukunden bleibt 20, aber nur wenn `paymentMethod` (initial) `deposit_online` ist; sonst 0.

2. **`computeDeposit` (`PublicOffer.tsx`)**
   - Signatur erweitern: `inquiry` muss `payment_method` kennen.
   - Wenn `payment_method ∈ {on_site, pay_on_site, invoice_after, invoice_after_event}` ⇒ `show: false`, `amount: 0`.
   - `pct = inquiry.deposit_percent ?? 20` → `?? (paymentMethod === 'deposit_online' ? 20 : 0)`. Sicherer Default nur, wenn auch wirklich Anzahlungs-Modus.
   - `pct === 0` ⇒ `show: false` (ist schon da, bleibt).

3. **`ProposalView.tsx` & `FinalOfferView.tsx`**
   - Den lokalen `?? 20`-Fallback entfernen und die Logik über `computeDeposit` (oder eine analoge Helper) ziehen — Single Source of Truth.
   - Anzeige des Anzahlungs-Blocks an `deposit.show` koppeln (nicht nur an Prozent), inkl. Render-Guards bei `on_site` / `invoice_after`.

4. **Server-side Härtung (Red Team)**
   - `create-payment-session/index.ts`: vor Stripe-Checkout Re-Compute des Betrags **server-seitig** aus DB-Werten (`v2_events.deposit_percent/amount/payment_method` + Total aus Quotation). Client-übergebenen `amount` nur als Anzeige nutzen, niemals an Stripe weiterreichen.
   - Bei `payment_method ∈ {on_site, invoice_after}` ⇒ 400, kein Stripe-Session-Create für `deposit`-Type.
   - Logging: `[deposit-recompute] client=… server=…` bei Abweichung, damit Drift sichtbar wird.

### QA-Checklist
- 0% + `deposit_online` ⇒ Public Offer zeigt "Komplette Zahlung", kein Anzahlungs-Block, Stripe-Button "Jetzt zahlen" mit Total.
- 0% + `invoice_after` ⇒ kein Stripe-Block, nur Hinweistext "Rechnung nach Veranstaltung, zahlbar binnen X Tagen".
- 30% + `deposit_online` ⇒ Anzahlungs-Block 30%.
- DB hat `deposit_percent = null` + `payment_method = on_site` ⇒ Public Offer zeigt **keine** Anzahlung (nicht mehr 20).
- Manuelle Stripe-Manipulation (Param-Edit) im Browser ⇒ Server lehnt mit 400 ab.

---

## Teil 2 — UI-Verkabelung Anzahlungs-/Schlussrechnung

### Was schon liegt
- `create-lexoffice-downpayment-invoice` Edge Function (deployed).
- `create-lexoffice-final-invoice` Edge Function (deployed).
- `handle-stripe-webhook` ruft automatisch je nach `payment_type`.
- Migration: `final_lexoffice_invoice_id/number` auf `v2_events`.

### Was fehlt

1. **`AddPaymentDrawer.tsx`** — bei manuell als `paid` markiertem Payment (`deposit`/`prepayment`/`final`) direkt die passende Edge Function callen (analog zur Webhook-Logik). Spinner + Toast "Anzahlungsrechnung erstellt" / "Schlussrechnung erstellt".

2. **`PaymentCard.tsx`**
   - Pro bezahltem `deposit`/`prepayment`-Payment Button "Anzahlungsrechnung öffnen" (Link zu LexOffice-PDF via vorhandene Doc-Retrieval-Logik).
   - Falls `lexoffice_invoice_id` fehlt: Button "Anzahlungsrechnung nachholen" → ruft `create-lexoffice-downpayment-invoice`.
   - Neuer Button "Schlussrechnung erstellen" (sichtbar wenn alle Payments paid und `final_lexoffice_invoice_id` leer).

3. **Inquiry Sidebar / LexOffice Documents Liste**
   - Anzahlungsrechnungen + Schlussrechnung neben Angebot/Voucher anzeigen (bestehende Doc-Visibility-Komponente erweitern).

4. **Idempotenz im UI**
   - Buttons disabled wenn Function bereits einmal erfolgreich (anhand persistierter `lexoffice_invoice_id`).

### Out of scope
- LexOffice-Storno-Flow.
- Historische Backfill-Migration für bestehende Payments.
- `is_reservation_fee`-Editor-UI (Flag liegt, UI später).

### QA
- Manuell als bezahlt markierte 30%-Anzahlung ⇒ Anzahlungsrechnung in LexOffice, PDF-Mail raus, Button "Anzahlungsrechnung öffnen" verfügbar.
- 2× Anzahlung ⇒ 2 Rechnungen, fortlaufende Nummern.
- Klick "Schlussrechnung erstellen" ⇒ Schlussrechnung mit `abzgl.`-Zeilen pro Anzahlung, Centbeträge stimmen.
- Doppelklick / Reload ⇒ keine Doppelrechnung (Idempotenz).
