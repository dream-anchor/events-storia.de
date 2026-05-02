
# Deep-Dive Audit — Mai 2026

## Rolle: Senior CX Experte + Senior UI/UX Experte

---

## KRITISCH (Umsatzverlust-Risiko)

### 1. Multi-Option-Zahlung wird im Webhook nicht verarbeitet

**Schweregrad:** KRITISCH — Geld wird eingezogen, Buchung wird nie erstellt.

`create-payment-session` (Multi-Option-Pfad, Zeile 187-192) setzt Stripe-Metadata:
```
{ inquiry_id, payment_type, option_quantities, total_amount, deposit_percent }
```

`handle-stripe-webhook` (Zeile 86) prüft:
```
metadata.option_id && metadata.inquiry_id
```

**`option_id` ist im Multi-Option-Pfad nicht gesetzt** — der Webhook loggt "Unknown payment type" und die Zahlung bleibt unverarbeitet. Kein Booking, kein LexOffice, kein Status-Update.

**Fix:** Neuen Branch in `handle-stripe-webhook` hinzufügen:
```
} else if (metadata.option_quantities && metadata.inquiry_id) {
  await handleMultiOptionPayment(supabase, stripe, session, metadata);
}
```
Neue Funktion `handleMultiOptionPayment`: paid_amount/remaining_amount setzen, v2_payments anlegen, offer_phase → confirmed, LexOffice-Rechnung triggern.

---

## MITTEL (Funktionslücken)

### 2. Offline-Buchung (Vor Ort / Rechnung) ignoriert Multi-Option-Mengen

`confirm_offline_booking` (SQL-Funktion) akzeptiert nur `p_selected_option_id` — keinen Mechanismus für mehrere Optionen mit unterschiedlichen Mengen. Kunden mit `payment_method = 'on_site'` und Multi-Option-Angeboten können nicht korrekt buchen.

**Fix:** Entweder `confirm_offline_booking` um `p_option_quantities jsonb` erweitern oder im PublicOffer die Multi-Option-Auswahl als einzelne zusammengefasste Option persistieren.

### 3. `payment=success` wird nicht im Frontend behandelt

Nach erfolgreicher Stripe-Zahlung leitet Stripe zu `?payment=success` weiter. Im `useEffect` (Zeile 307-319) wird nur `payment=cancelled` behandelt. Der Erfolgsfall zeigt keinen Toast — der Kunde sieht die Seite ohne Feedback, bis der Webhook durchgelaufen ist (1-10 Sekunden Latenz). Falls der Webhook fehlschlägt (Bug 1), sieht der Kunde ewig den alten Status.

**Fix:** `payment=success` ebenfalls behandeln: Toast "Zahlung erfolgreich — Ihre Buchung wird bestätigt" + Polling auf offer_phase-Änderung.

### 4. Kein Stripe Session Expiry Handling

`create-payment-session` setzt kein `expires_at` auf der Stripe Checkout Session. Standard-Ablauf ist 24h. Falls ein Kunde die Session nicht abschließt und 20h später zurückkehrt, funktioniert der Link noch — aber die Preise könnten sich geändert haben. Kein kritisches Problem, aber CX-Risiko.

**Empfehlung:** `expires_at: Math.floor(Date.now() / 1000) + 3600` (1h) setzen.

---

## NIEDRIG (Technische Schulden + CX-Optimierung)

### 5. PublicOffer.tsx — 3.002 Zeilen Monolith

7 useEffects, 17 catch-Blöcke, 5 Phasen in einer Datei. Wartbarkeit ist eingeschränkt, Debugging komplex. Empfehlung: In Subkomponenten aufteilen (ProposalView, ResponseView, PaymentView, ConfirmedView).

### 6. Security Definer Views (3 ERRORS im Linter)

Die 3 Compatibility-Views (`event_inquiries`, `event_bookings`, `catering_orders`) sind SECURITY DEFINER. Das ist **gewollt** als v1→v2 Adapter. Kann als "akzeptiertes Risiko" im Security Memory dokumentiert werden.

### 7. 10+ USING(true) RLS Policies

Betrifft hauptsächlich: `packages`, `menu_items`, `email_messages`, `activity_logs`. Teilweise gewollt (öffentliche Pakete, Admin-only Tabellen mit service_role). Sollte systematisch dokumentiert werden — welche sind absichtlich offen, welche versehentlich.

### 8. `handleEventOfferPayment` ruft `handle-offer-payment` per HTTP auf

Edge Function → Edge Function HTTP-Call (Zeile 295-305) ist fragil: Timeout-Risiken, doppelte Cold-Starts, kein Retry. Besser: Shared-Logic inline oder als importierte Funktion.

---

## Verifiziert & funktional

| Bereich | Status |
|---------|--------|
| Equipment/Staff Persistenz & Klonung | OK |
| LexOffice VAT-Splitting (7%/19%) | OK |
| AI-Anschreiben mit Equipment/Staff | OK |
| Kundenbestätigung-Emails | OK |
| PriceBreakdown Admin | OK |
| PublicOffer Equipment/Staff Anzeige | OK |
| Idempotenz in handle-offer-payment | OK (source_offer_option_id Check + 23505 Guard) |
| Stripe Webhook Signatur-Verifikation | OK |
| Race-Condition-Schutz submit_offer_response | OK (FOR UPDATE SKIP LOCKED) |
| Security-Härtung (REVOKE EXECUTE) | OK (Migration angewendet) |
| reconcile-payment-statuses auf v2-Tabellen | OK |
| Offline-Buchung (Einzeloption) | OK |
| Catering-Bestellflow | OK |
| Maestro Payment Flow | OK |

---

## Empfohlene Reihenfolge

1. **Bug 1** (kritisch) — Multi-Option Webhook sofort fixen
2. **Bug 3** — payment=success Toast + Polling
3. **Bug 2** — Offline-Buchung Multi-Option
4. **Bug 4** — Session Expiry
5. Security Memory updaten (Bugs 6+7 dokumentieren)
6. PublicOffer Refactoring (optional, kein Funktionsfehler)

Soll ich mit Fix 1 beginnen?
