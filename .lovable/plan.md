## Ziel

Die jetzige Auswahl in Maestro ist ein **Single-Choice (ODER)**: entweder „Anzahlung + Online", „Vorauszahlung", „Vor Ort" oder „Rechnung". In der Realität sind das aber zwei unabhängige Entscheidungen:

1. **Anzahlung** — wie wird sie eingezogen?
2. **Restzahlung** — wie wird sie eingezogen?

Daraus ergeben sich Kombinationen wie „Anzahlung per Stripe + Rest vor Ort", „Anzahlung per Stripe + Rest per Stripe vorab", „keine Anzahlung + Rechnung nach Event" usw. Dazu kommt eine neue automatische 7‑Tage-Erinnerung für offene Stripe-Vorauszahlungen.

---

## 1. Maestro UI — neuer „Zahlungs-Konditionen" Block

Statt 4 Kacheln (ODER) zwei Spalten:

```text
ANZAHLUNG                        RESTZAHLUNG
[ ] Keine Anzahlung              [ ] Stripe – vorab (Link in Mail)
[x] Stripe – sofort online       [x] Vor Ort beim Event
[ ] Vor Ort (Bar/EC am Event)    [ ] Rechnung nach Event
[ ] Auf Rechnung (vor Event)
```

Verhalten:
- Wenn Anzahlung = „Keine" → unten nur Restzahlungs-Methode.
- Wenn Restzahlung = „Stripe vorab" → Feld „Zahlungsfrist vor Event (Tage)" sichtbar (Default 14).
- Wenn Restzahlung = „Rechnung nach Event" → „Zahlungsfrist nach Event (Tage)" sichtbar (Default 14).
- Wenn Anzahlung != „Keine" → Felder Höhe (%/€) + Anzahlungs-Frist sichtbar.
- Angebots-Gültigkeit bleibt eigenes Feld.
- Live‑Summary unten („Anzahlung 20 % per Stripe innerhalb 5 Tage, Restzahlung vor Ort am Event. Angebot 14 Tage gültig.").

### Datenmodell

Neue Spalten in `v2_events`:
- `deposit_method TEXT` — `none | stripe | on_site | invoice`
- `balance_method TEXT` — `stripe_prepay | on_site | invoice_after`
- `balance_due_days_before_event INTEGER NULL` — für Stripe-Vorab (Default 14)

`payment_method` / `payment_timing` werden für Rückwärtskompatibilität **automatisch befüllt** via Trigger oder beim Speichern (z. B. `deposit_method='stripe' + balance_method='on_site'` → `payment_method='deposit_online'`, `payment_timing='on_site'`), damit alle bestehenden Edge Functions und der Public-Offer-Flow ohne Brüche weiterlaufen.

Migration:
```sql
ALTER TABLE v2_events
  ADD COLUMN deposit_method TEXT
    CHECK (deposit_method IN ('none','stripe','on_site','invoice')),
  ADD COLUMN balance_method TEXT
    CHECK (balance_method IN ('stripe_prepay','on_site','invoice_after')),
  ADD COLUMN balance_due_days_before_event INTEGER
    CHECK (balance_due_days_before_event IS NULL OR balance_due_days_before_event >= 1);

-- Backfill aus altem payment_method
UPDATE v2_events SET
  deposit_method = CASE
    WHEN payment_method = 'deposit_online' THEN 'stripe'
    WHEN payment_method = 'prepayment_online' THEN 'none'  -- Vorauszahlung = nur Rest
    ELSE 'none' END,
  balance_method = CASE
    WHEN payment_method IN ('deposit_online','prepayment_online') THEN 'stripe_prepay'
    WHEN payment_method = 'on_site' THEN 'on_site'
    WHEN payment_method = 'invoice_after' THEN 'invoice_after'
    ELSE 'on_site' END
WHERE deposit_method IS NULL;
```

---

## 2. Public Offer (Kunde sieht)

`ProposalView` / `PaymentSection` lesen `deposit_method` + `balance_method`:
- Anzahlung-Block nur wenn `deposit_method != 'none'`. Bei `stripe` Stripe-Button, bei `on_site`/`invoice` reiner Hinweistext + „Verbindlich buchen"-Flow (3 Checkboxen).
- Restzahlungs-Block immer als Erklärtext („Restbetrag wird vor Ort beglichen" / „Sie erhalten 14 Tage vor dem Event einen Stripe-Link" / „Rechnung nach Event").
- Wenn beide nicht-Stripe → reiner „Verbindlich buchen"-Flow (kein Stripe).

---

## 3. Bestätigungs- und Folgemails

`send-payment-confirmation-v2` bekommt Felder `depositMethod`, `balanceMethod`, `balanceDueDaysBeforeEvent` und rendert die Restzahlungs-Sektion konditional:
- `stripe_prepay` → „Den Stripe-Link für den Restbetrag erhalten Sie automatisch X Tage vor dem Event." (oder direkt mit `prepayment_invite`-Modus)
- `on_site` → „Restbetrag bitte vor Ort beim Event begleichen."
- `invoice_after` → „Restbetrag wird nach dem Event per Rechnung (Zahlungsziel X Tage) berechnet."

Pro‑Person‑Link (`create-prepayment-link`) bleibt; greift jetzt nur noch, wenn `balance_method='stripe_prepay'`.

---

## 4. 7‑Tage Stripe‑Erinnerung (CRITICAL)

In `supabase/functions/send-scheduled-reminders/index.ts` neuer Block **4. STRIPE-RESTZAHLUNG OFFEN (7 Tage vor Event)**:

Logik (Tages-Cron):
1. Hole alle `v2_events` mit `event_date = today + 7` UND `balance_method = 'stripe_prepay'`.
2. Für jedes Event Summen aus `v2_payments` ziehen:
   - `totalDue = amount_total` (aktives `is_chosen`-Angebot)
   - `totalPaid = SUM(amount_cents WHERE status='paid')`
3. **Skip wenn `totalPaid >= totalDue`** (vollständig bezahlt) — CRITICAL.
4. Skip wenn bereits eine Erinnerung mit `kind='balance_reminder_7d'` für diesen Event in `email_delivery_logs` existiert (Idempotenz).
5. Sonst Mail an Kunde + **CC info@events-storia.de** mit:
   - Restbetrag offen (Total − bereits gezahlt)
   - Stripe-Payment-Link (falls bereits erzeugt) ODER Button, der `create-prepayment-link` triggert
   - Hinweis Datum + Frist
6. Log mit `metadata: { reminder: 'balance_7d' }` für Idempotenz.

Ergebnis‑Typ um `balance_reminder` erweitern.

---

## 5. Mail-Vorschau (Preview-Route)

Bestehende `/admin/email-preview` (oder neue Route falls keine) zeigt 6 Modi nebeneinander, jetzt erweitert um die neuen Kombis:
1. Buchungsbestätigung — Anzahlung Stripe + Rest vor Ort
2. Buchungsbestätigung — Anzahlung Stripe + Rest Stripe vorab
3. Buchungsbestätigung — Keine Anzahlung + Rechnung nach Event
4. Pro-Person-Restzahlungs-Einladung (`prepayment_invite`)
5. **NEU**: 7‑Tage Stripe-Restzahlungs-Erinnerung (Kunde)
6. **NEU**: 7‑Tage Stripe-Restzahlungs-Erinnerung (Betreiber-CC)

Die Vorschau rendert die echten HTML-Strings aus den Edge-Functions (entweder via `invoke({ mode: 'preview' })` oder lokaler Renderer-Helper in `src/lib/email-previews.ts`).

---

## 6. Reihenfolge der Umsetzung (nach Approval)

1. Migration `deposit_method` / `balance_method` / `balance_due_days_before_event` + Backfill.
2. `PaymentTermsBlock.tsx` umbauen auf Doppel-Auswahl, plus Mapping auf legacy `payment_method`/`payment_timing`.
3. `send-payment-confirmation-v2` um konditionale Restzahlungs-Sektion erweitern.
4. `send-scheduled-reminders` Block 4 (7‑Tage Stripe-Erinnerung mit Skip‑wenn‑bezahlt + Idempotenz).
5. `PaymentSection.tsx` (Public Offer) auf neue Felder umstellen.
6. Mail‑Vorschau-Route erweitern und alle 6 Varianten zeigen.

---

## Hinweis

Punkt 6 (Vorschau ausgeben) liefere ich am Ende als Screenshots/HTML-Render im Chat zurück.
