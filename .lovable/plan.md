# Stripe-Mengenanpassung → Nachberechnung / Storno, sichtbar in MAESTRO

## Teil 1 — Präzisierter Prompt (überarbeitete Fassung)

> **Rolle:** Senior System Architekt (+ Payment/Accounting Domain Lead, Red Team, UX Lead)
>
> Ziel: Jede Stripe-Zahlung muss in MAESTRO lückenlos sichtbar und buchhalterisch abgeschlossen sein — auch wenn der Kunde auf der Stripe-Zahlungsseite die Personenzahl selbst ändert.
>
> Zu lösende Fälle:
> 1. Zahlung zur ursprünglich kalkulierten Personenzahl → Abgleich, Rechnung, Sichtbarkeit.
> 2. Kunde erhöht die Personenzahl → Differenz als Nachberechnung (zusätzliche Rechnung).
> 3. Kunde reduziert, Betrag bereits (teilweise) gezahlt → Storno-/Korrekturbeleg plus optionale Rückerstattung.
> 4. Kunde reduziert, noch nichts gezahlt → reine Anpassung ohne Beleg.
>
> Anforderungen: Zahlung, bestätigte Personenzahl, Differenzbetrag und Belegstatus sind im Event-Detail sichtbar; Rechnungen/Stornos werden dort auf Knopfdruck über LexOffice erzeugt und bilingual versendet; jede Aktion ist auditierbar und idempotent; Maestro bleibt Single Source of Truth für Beträge (keine Neuberechnung/Rundung).
>
> Liefere: Datenmodell, Ereignis-/Statusfluss, Backend-Verarbeitung, Admin-UI, Fehler-/Missbrauchsszenarien (Red Team) und einen Umsetzungsplan in Phasen.

## Teil 2 — Ist-Zustand (verifiziert)

- `create-prepayment-link` erzeugt Stripe-Links mit `adjustable_quantity` (min/max Gäste) — der Kunde kann die Personenzahl heute schon ändern.
- Der Webhook (`handle-stripe-webhook` → `handlePrepaymentPerPerson`) liest die finale Menge aus den Line Items, setzt `v2_events.guest_count` und schreibt einen Activity-Log.
- **Bug:** Beim Insert wird `payment_type: "balance"` verwendet. Das Enum `v2_payment_type` kennt nur `deposit, prepayment, final, full, refund` — der Insert schlägt fehl, der Rückgabewert wird nicht geprüft. Gleiches in `create-balance-checkout`. Zahlungen dieser Wege landen dadurch nicht in `v2_payments`.
- Für `prepayment_per_person` wird **keine** LexOffice-Rechnung ausgelöst (nur die klassischen Deposit-/Final-Pfade rufen `create-lexoffice-*` auf).
- Es gibt kein Feld für „kalkulierte vs. in Stripe bestätigte Gästezahl" und keine Differenz-/Storno-Entität.

## Teil 3 — Zielkonzept

### 3.1 Datenmodell
- `v2_payment_type` um `adjustment` (Nachberechnung) und `credit_note` (Storno/Gutschrift) erweitern; `balance` sauber auf `final` mappen (Bug-Fix).
- `v2_payments` neu: `guests_charged`, `price_per_person_cents`, `lexoffice_credit_note_id`, `parent_payment_id`, `stripe_refund_id`.
- `v2_events` neu: `guests_quoted` (Stand Angebot), `guests_confirmed` (aus Stripe), `guest_delta_settled_at`.
- Neue Tabelle `v2_guest_adjustments`: event_id, payment_id, guests_before/after, delta_guests, delta_amount_cents, kind (`surcharge` | `refund_due` | `note_only`), status (`open` | `invoiced` | `refunded` | `waived`), LexOffice-IDs, created_by, timestamps — inkl. GRANTs und RLS wie bei `v2_payments`.

### 3.2 Ablauf
```text
Stripe Checkout (adjustable_quantity)
        │ webhook checkout.session.completed
        ▼
Webhook: finale Menge + amount_total aus Stripe lesen (Stripe = Wahrheit über das Gezahlte)
        ├─ v2_payments upsert (idempotent auf session.id), guests_charged setzen
        ├─ v2_events.guests_confirmed setzen
        └─ Delta = guests_confirmed − guests_quoted
             ├─ Delta > 0  → Adjustment „surcharge", Status open
             ├─ Delta < 0 und bereits gezahlt → „refund_due", Status open
             ├─ Delta < 0 und nichts gezahlt  → „note_only", direkt erledigt
             └─ Delta = 0 → kein Eintrag
        ▼
LexOffice: Rechnung über den tatsächlich gezahlten Betrag (bestehende Pflichtregel)
        ▼
MAESTRO Event-Detail: Banner „Gästezahl geändert: 40 → 46 (+6, +1.560 €)" mit Aktionen
```
Beträge stammen 1:1 aus Stripe bzw. der Maestro-Kalkulation — keine Neuberechnung, kein Runden.

### 3.3 Admin-UI (MAESTRO)
- **PaymentCard / PaymentStatusStrip**: pro Zahlung „46 Gäste × 260 € · gezahlt via card · Rechnung RE-2026-xxx".
- **Neue `GuestAdjustmentCard`** im Event-Detail, sichtbar sobald ein offenes Adjustment existiert:
  - Mehrbetrag: „Nachberechnung als Rechnung erstellen" (LexOffice) und „Zahlungslink für Differenz senden".
  - Minderbetrag: „Stornorechnung / Gutschrift erstellen" plus optional „Betrag via Stripe erstatten" (erzeugt `refund`-Payment + Gutschrift).
  - „Ohne Beleg abschließen" (waive) mit Pflicht-Notiz.
  - Erstellen/Erstatten nur für Rolle `admin`.
- Kanban/Liste: Badge „Gästezahl-Differenz offen", damit nichts liegen bleibt.
- Kundenmails bilingual (DE-Block, Trenner, EN-Block) nach bestehendem Standard.

### 3.4 Backend-Funktionen
- `handle-stripe-webhook`: Payment-Type-Fix, Insert-Fehler prüfen und in `system_errors` loggen, Adjustment-Erzeugung, LexOffice-Rechnung auch für Prepayment/Balance, Maestro-Handoff mit finaler Gästezahl.
- Neu `create-guest-adjustment-invoice`: erzeugt Rechnung (surcharge) bzw. Gutschrift/Storno (refund_due) in LexOffice mit `taxType='gross'`, versendet Kundenmail, schreibt IDs zurück, idempotent über Adjustment-ID.
- Neu `refund-guest-adjustment`: Stripe-Teilerstattung + `refund`-Payment + Statuswechsel.
- `create-balance-checkout`: gleicher Payment-Type-Fix, `guests_charged` mitschreiben.
- `reconcile-payment-statuses`: Nachlauf-Abgleich für Sessions ohne Payment-Zeile (repariert Altfälle).

### 3.5 Red Team / Randfälle
- Webhook-Doppelzustellung → Idempotenz über `stripe_checkout_session_id`, Unique-Adjustment je Payment.
- Menge unter Vertragsminimum → `adjustable_quantity.minimum` plus serverseitige Prüfung; Abweichung wird als Adjustment mit Warnung sichtbar.
- Erstattung größer als gezahlter Betrag → serverseitige Deckelung.
- Bestehende LexOffice-Rechnung wird nie mutiert — Korrektur immer als neuer Beleg (Gutschrift).
- LexOffice nicht erreichbar → Adjustment bleibt `open`, Fehlermeldung auf Deutsch im UI.
- Stripe-Webhook-Ausfall → Reconcile-Job holt Zahlungen nach, Adjustments entstehen trotzdem.
- POS-/Vor-Ort-Zahlung ersetzt keine Stripe-Rechnung (bestehende Regel bleibt).

### 3.6 Phasen
1. **Fix & Sichtbarkeit:** Enum/Payment-Type-Bug, Fehlerprüfung, `guests_charged`, Gästezahl je Zahlung anzeigen, Altfälle abgleichen.
2. **Delta-Erkennung:** `v2_guest_adjustments`, Webhook-Logik, Banner + Badge in MAESTRO.
3. **Belege:** LexOffice-Rechnung/Gutschrift-Funktionen, bilinguale Kundenmails, Dokumente in der Anfrage sichtbar.
4. **Erstattung & Automatisierung:** Stripe-Refunds, optionale Auto-Rechnung bei Mehrbetrag, Reporting.

### Technische Details
Migrationen: Enum-Erweiterung, neue Spalten, neue Tabelle inkl. GRANTs und RLS (admin/staff lesen, admin schreibt). Betroffen: `supabase/functions/handle-stripe-webhook/index.ts`, `create-prepayment-link`, `create-balance-checkout`, zwei neue Edge Functions, `src/components/admin/refine/InquiryEditor/PaymentCard.tsx`, `PaymentStatusStrip.tsx`, neue `GuestAdjustmentCard.tsx` sowie ein Hook unter `src/hooks/`.