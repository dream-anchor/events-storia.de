
## Was wird gemacht (Schritt für Schritt)

**Wichtig:** Keine automatischen E-Mails an Kunden. Antoine löst alles manuell per Button aus, nach Rücksprache mit dem Betreiber.

---

### 1. Bug A — Catering-Editor Zahlungsstand stimmt nicht

In `src/components/admin/refine/CateringOrderEditor.tsx` (Z. 988–995):
- `totalEur={grandTotal}` statt `Number(order.total_amount)` → nimmt die live berechnete Brutto-Summe (Artikel + Lieferung + Mindestbestell-Aufschlag = 231,80 €), die der Editor oben bereits korrekt anzeigt.
- `externalPaidEur={0}` statt der bisherigen Doppelzählung. Die `v2_payments`-Zeile von 22 € existiert bereits; die alte Logik addierte `order.total_amount` zusätzlich → "Bezahlt 44 €". Fix: nichts mehr addieren.

Ergebnis: Card zeigt **Gesamt 231,80 € · Bezahlt 22 € · Offen 209,80 €**, passend zum echten Stand.

### 2. Bug B — Cyim-Zahlung wurde mit 2.590 € statt 500 € gespeichert

In `supabase/functions/handle-stripe-webhook/index.ts` → `processEventOfferPaymentInline`:
- `amountCents` aus `session.amount_total` (Fallback: `option.amount_total * 100`).
- `payment_type` aus `session.metadata.payment_type` (`full`|`deposit`); falls fehlt → automatisch ableiten: gezahlte Summe < Angebotsgesamt → `'deposit'`, sonst `'full'`.
- Wenn `deposit`: Event-Status auf `confirmed` + `offer_phase='confirmed'` (statt `paid`), `paid_amount`/`remaining_amount` setzen. Bei `full` bleibt es bei `paid`.

### 3. Daten-Backfill für die zwei Cyim-Datensätze

Einmaliges UPDATE über die Insert-Funktion (zugelassen für UPDATEs hier? nein — Migration nötig):
- `v2_payments` `897c9308-4135-4b6e-a0a3-0606eff8c46d` → `amount_cents=50000`, `payment_type='deposit'`.
- `v2_events` `90321866-239d-4331-a85b-fddf5280ce97` → `status='confirmed'`, `offer_phase='confirmed'`, `paid_amount=500`, `remaining_amount=2090` (falls die Felder existieren — sonst nur status).

### 4. Neue Edge Function `send-payment-confirmation-v2`

Versendet eine Zahlungsbestätigung im **bestehenden Storia-Look** (übernommen aus `send-payment-email`, gleicher schwarzer Header, Karlstraße-Footer):
- Input: `{ payment_id: uuid, include_apology?: boolean }`.
- Lädt `v2_payments` + `v2_events` + `v2_customers`.
- Subject: `"Zahlungseingang bestätigt: {Anzahlung|Zahlung} – {Buchungsnummer}"`.
- Body:
  - Begrüßung mit Kundenname.
  - Optionaler Apology-Block (nur wenn `include_apology=true`):
    > „Aufgrund eines technischen Fehlers ist die Bestätigung Ihrer Zahlung leider verspätet bei Ihnen eingetroffen. Bitte entschuldigen Sie diese Verzögerung. Ihre Anzahlung in Höhe von **{Betrag}** ist bei uns eingegangen und wurde erfolgreich verbucht."
  - Standard-Bestätigung: Betrag, Datum, Buchungsnummer, Veranstaltungsdatum.
  - Stornobedingungen-Hinweis (wie bestehende Mail).
  - Footer mit Karlstraße 47a etc.
- BCC `info@events-storia.de`.
- Schreibt `activity_logs`-Eintrag `payment_confirmation_email_sent` (mit `metadata.with_apology`).
- **KEIN automatischer Aufruf aus dem Webhook.**

### 5. PaymentBalanceCard – manueller Sende-Button pro bezahlter Zeile

In `src/components/admin/shared/PaymentBalanceCard.tsx`:
- Für jede `paid`-Zeile zusätzlich ein kleiner Outline-Button **„Bestätigung senden"** rechts neben dem Status.
- Klick öffnet einen kleinen Dialog mit:
  - Checkbox „Entschuldigung für verspätete Bestätigung mitschicken" (default an, falls die Zahlung > 24 h alt ist und noch nie bestätigt wurde).
  - Vorschau der Empfänger-Adresse und des Betrags.
  - Bestätigen → ruft `send-payment-confirmation-v2` mit `{ payment_id, include_apology }`.
- Toast „Bestätigung versendet".
- Nach Erfolg wird der Button auf „Erneut senden" gewechselt (kein Lock-Out, da Antoine ggf. nochmal manuell senden möchte).

### 6. Verifikation (nach Approval)

- Catering-Editor `CAT-BESTELLUNG-24-05-2026-887` öffnen → Zahlungsstand 231,80/22/209,80.
- Cyim-Event öffnen → Zahlungsstand 2.590/500/2.090.
- Manuell „Bestätigung senden (mit Entschuldigung)" für Cyim & Rigshospitalet auslösen, sobald Antoine grünes Licht gibt.
- Test-Webhook-Aufruf (deposit + full) gegen die korrigierte `processEventOfferPaymentInline` (mit Mock-Session).

## Technische Details (für Devs)

- **Geänderte Dateien:**
  - `src/components/admin/refine/CateringOrderEditor.tsx` (2 Zeilen)
  - `src/components/admin/shared/PaymentBalanceCard.tsx` (Button + Dialog)
  - `supabase/functions/handle-stripe-webhook/index.ts` (`processEventOfferPaymentInline` Z. 367–417)
- **Neu:** `supabase/functions/send-payment-confirmation-v2/index.ts` (~180 Z., Template aus `send-payment-email` recyclet, kein neuer Provider).
- **Migration:** kurzes UPDATE für die zwei Cyim-Datensätze; keine Schema-Änderungen.
- **Mailversand bleibt manuell**: Webhook löst weiterhin keine Kunden-Mail aus (das war Bug C und wird hier bewusst NICHT automatisiert).
