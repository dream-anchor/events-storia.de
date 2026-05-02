
# Deep-Dive Audit -- Mai 2026

## Status-Zusammenfassung

| Bereich | Funktioniert | Probleme | Risiko |
|---------|:---:|:---:|:---:|
| PublicOffer Refactoring | Ja (336 Zeilen Orchestrator) | ProposalView 1.333 Zeilen | Mittel |
| Single-Option Stripe-Zahlung | Ja | -- | -- |
| Multi-Option Stripe-Zahlung | Teilweise | **Bug P1** | Hoch |
| Offline-Buchung (on_site/invoice) | Ja (Single + Multi) | -- | -- |
| Stripe Webhook Routing | Ja (5 Pfade) | -- | -- |
| LexOffice Integration | Ja | Edge-to-Edge HTTP | Mittel |
| Offer Lifecycle (Phasen) | Ja | -- | -- |
| Archiv-Modus | Ja | -- | -- |
| Stripe Session Expiry | Ja (1h) | -- | -- |
| Payment Success Polling | Ja | -- | -- |
| Security (Linter) | -- | **79 Findings** | Hoch |

---

## P1 -- Kritische Bugs (Funktion betroffen)

### Bug 1: Multi-Option Webhook setzt `selected_quantity` NICHT
**Wo:** `handle-stripe-webhook` > `handleMultiOptionPayment()` (Zeile 646-806)
**Problem:** Nach erfolgreicher Stripe-Zahlung werden die `v2_offer_options` Zeilen NICHT mit `is_chosen=true` und `selected_quantity` aktualisiert. Im Gegensatz dazu:
- `confirm_offline_booking_multi` (SQL) setzt `is_chosen`, `chosen_at`, `selected_quantity` korrekt
- `create-payment-session` setzt `selected_quantity` VOR Stripe-Checkout (Zeile 197-203)

**Auswirkung:** Nach Stripe-Zahlung im Multi-Option-Flow fehlen die gewählten Mengen auf den Optionen. LexOffice-Rechnungen und Admin-Dashboard zeigen keine Zuordnung. Die `create-manual-invoice` Edge Function (Zeile 775) liest `useSelectedQuantity: true` -- bekommt aber ggf. die Pre-Checkout-Werte, nicht die endgultigen.

**Fix:** In `handleMultiOptionPayment` nach Zeile 700 die `optionQuantities` durchiterieren und `v2_offer_options` mit `is_chosen`, `chosen_at`, `selected_quantity` updaten + nicht gewählte deaktivieren.

### Bug 2: `get_public_offer` liefert `event_end_date` nicht
**Wo:** SQL-Funktion `get_public_offer` + `HeroSection.tsx`, `ConfirmationView.tsx`
**Problem:** Die RPC-Funktion baut das JSON ohne `event_end_date`. Frontend-Code referenziert es (types.ts Zeile 22, HeroSection Zeile 56-57) -- Wert ist immer `null`.
**Auswirkung:** Mehrtägige Events zeigen nur das Startdatum, nie den Enddatum-Range.
**Fix:** `event_end_date` in `get_public_offer` hinzufügen (`ei.event_end_date` bzw. aus `v2_events`).

---

## P2 -- Mittlere Probleme

### Problem 3: ProposalView ist 1.333 Zeilen
**Wo:** `src/pages/public-offer/ProposalView.tsx`
**Problem:** Der Refactor hat `PublicOffer.tsx` entlastet (336 Zeilen), aber die gesamte Interaktionslogik (Mengen-Handling, 3 Action-Handler, Carousel, Optionskarten, Summary, CTA-Bereich, Mobile-Progress) lebt in einer einzigen Datei.
**Risiko:** Wartbarkeit, Re-Render-Performance bei Mengenänderungen (alle Karten re-rendern).
**Fix:** Extrahieren in `OptionCard.tsx`, `MultiOptionCarousel.tsx`, `PaymentActions.tsx`, `useOfferActions.ts` Hook.

### Problem 4: `handle-offer-payment` Edge Function existiert noch
**Wo:** `supabase/functions/handle-offer-payment/`
**Problem:** Die Logik wurde inline in `handle-stripe-webhook` verschoben, aber die alte Funktion existiert noch als Deployment. Toter Code, potenzielle Verwirrung.
**Fix:** Verzeichnis löschen.

### Problem 5: LexOffice via Edge-to-Edge HTTP im Webhook
**Wo:** `handle-stripe-webhook` Zeilen 188-198 (Catering), 463-473 (Single-Option), 767-777 (Multi-Option)
**Problem:** 3 verschiedene Stellen rufen LexOffice-Erstellung über interne HTTP-Calls auf. Zwar non-fatal, aber:
- Cold-Start-Overhead (3 verschiedene Functions)
- Keine Retry-Logik bei transientem Fehler
- Inkonsistente Payloads (Catering vs. Event vs. Multi-Option)
**Risiko:** Gelegentlich fehlende Rechnungen bei Timeouts.

### Problem 6: 79 Security-Linter-Findings
**Aufschlüsselung:**
- 3x SECURITY DEFINER View (ERROR) -- die Compatibility-Views. Dokumentiert und akzeptiert.
- 1x Extension in Public (WARN)
- ~9x RLS Policy Always True (WARN) -- betrifft `packages`, `menu_items` etc. (public catalog, intentional)
- 1x Public Bucket Allows Listing
- ~20x Public can execute SECURITY DEFINER Function -- betrifft `get_public_offer`, `get_public_offer_by_slug`, `confirm_offline_booking*`, `submit_offer_response` etc.
- ~24x Authenticated can execute SECURITY DEFINER Function

Die Public-SECURITY-DEFINER-Warnungen für `get_public_offer` und `confirm_offline_booking` sind by design (anonymer Kundenzugriff). ABER: `get_next_order_number`, `catering_orders_insert_trigger`, `generate_booking_number` etc. sollten NICHT public-executable sein.

**Fix:** `REVOKE EXECUTE ON FUNCTION ... FROM anon;` für alle internen Trigger-/Helper-Funktionen.

---

## P3 -- Potenzielle Risiken (noch kein Bug, aber absehbar)

### Risiko 7: Deposit-Flow ohne Restzahlungs-Tracking
**Wo:** Multi-Option + Single-Option Stripe-Pfad
**Problem:** Bei `paymentType === 'deposit'` wird `remaining_amount` gesetzt, aber es gibt keinen automatischen Workflow, der die Restzahlung vor dem Event einfordert. Das `send-scheduled-reminders` System ist vorhanden, aber die Verknüpfung zwischen `remaining_amount > 0` und automatischer Zahlungserinnerung fehlt.
**Risiko:** Kunden zahlen Anzahlung, aber Restbetrag wird vergessen.

### Risiko 8: Race Condition bei parallelen Stripe-Webhooks
**Wo:** `handleMultiOptionPayment` Idempotenz-Check (Zeile 671-681)
**Problem:** Prüft auf `stripe_checkout_session_id` -- gut. Aber die `event_inquiries.update` (Zeile 702-709) hat keinen `FOR UPDATE SKIP LOCKED` wie `submit_offer_response`. Bei extrem schnellen Retries könnte der Status doppelt geschrieben werden. In der Praxis unwahrscheinlich wegen Stripes 5s-Retry-Delay.

### Risiko 9: localStorage-Abhängigkeit für Mengen
**Wo:** `ProposalView.tsx` Zeile 63-101
**Problem:** Mengen werden in `localStorage` persistiert, um Stripe-Cancel-Redirect zu überleben. Aber:
- Private Browsing / Safari löscht localStorage aggressiver
- Wenn Kunde auf anderem Gerät öffnet, fehlen die Mengen
- `create-payment-session` speichert `selected_quantity` VOR Checkout -- bei Cancel und erneutem Versuch mit geänderten Mengen werden die alten DB-Werte nicht bereinigt.

---

## Empfohlene Reihenfolge

1. **Bug 1** (P1): Multi-Option Webhook `selected_quantity` + `is_chosen` setzen
2. **Bug 2** (P1): `event_end_date` in `get_public_offer` aufnehmen
3. **Problem 6** (Security): `REVOKE EXECUTE` auf interne Funktionen
4. **Problem 4** (Cleanup): `handle-offer-payment` Verzeichnis entfernen
5. **Problem 3** (Refactor): ProposalView aufteilen (optional, Wartbarkeit)

Soll ich mit der Umsetzung beginnen?
