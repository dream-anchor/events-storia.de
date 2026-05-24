# Restzahlung über Stripe automatisieren + Mail-Vorschauen v3

## Teil 1 — Automatisierung „Stripe – vorab" wird Standard-Logik

**Heute:** Manueller DB-Eintrag in `balance_payment_links` und manuell zusammengebauter `buy.stripe.com`-Link in Mails.
**Ziel:** Sobald in einer Inquiry die **Restzahlung = „Stripe – vorab"** ist, läuft alles automatisch über `/restzahlung/<slug>`.

### Was passiert automatisch

1. **Slug-Generierung & Eintrag**
   - Beim Speichern einer Inquiry mit `balance_method = 'stripe_prepay'` wird automatisch (DB-Trigger oder Edge-Function) ein Eintrag in `balance_payment_links` angelegt bzw. aktualisiert:
     - `slug` = `<nachname>-<order_number-suffix>` (lowercase, ohne Umlaute) — z. B. `windfeld-0100`
     - `event_label` / `event_label_en` aus Inquiry-Daten
     - `price_per_person_cents` = `event_price_per_person` aus Maestro (1:1)
     - `deposit_paid_cents` = bereits eingegangene Anzahlung (aus `v2_payments`, 1:1 — keine Neuberechnung)
     - `min_guests` = aktuelle bestätigte Gästezahl
     - `max_guests` = `min_guests + 30` (sinnvoller Puffer; konfigurierbar)
     - `default_guests` = `min_guests`
     - `customer_email`, `customer_name`, `event_id`, `event_date` aus Inquiry
     - `active = true` bis Zahlung eingegangen → dann `active = false`

2. **Mail-Versand (alle Restzahlungs-Mails)**
   - `create-balance-payment-link` & `send-payment-email` & `send-scheduled-reminders` werden so angepasst, dass bei `balance_method = 'stripe_prepay'` **niemals** mehr ein `stripe.paymentLinks.create(...)`-Aufruf gemacht wird.
   - Stattdessen wird der bestehende `balance_payment_links.slug` der Inquiry geholt und der Link `https://events-storia.de/restzahlung/<slug>` in die Mail gesetzt.
   - Bestehende Mail-Templates bekommen den neuen Link + den aktualisierten Erklärtext („Die Seite berechnet automatisch Preis × Gäste − Anzahlung").

3. **Zahlungsabgleich**
   - Stripe-Webhook (oder bestehender `reconcile-payment-statuses` Job) erkennt erfolgreiche Zahlungen via Session-Metadata (`balance_payment_link_id`) und setzt `active = false` + loggt in `v2_payments` + `activity_logs` (passiert teilweise schon in `create-balance-checkout`).

### Was sich für Admin/Maestro **nicht** ändert
- UI „Zahlungs-Konditionen" bleibt 1:1 wie im Screenshot
- Keine neuen Felder, kein neues Eingabeformular
- Preise/Anzahlungen kommen weiterhin **1:1** aus Maestro
- Andere Restzahlungs-Optionen („Vor Ort", „Rechnung nach Event") bleiben unverändert

### Was sich für den Kunden ändert
- Alle Restzahlungs-Mails verlinken auf die dynamische `/restzahlung/<slug>`-Seite
- Kunde wählt finale Gästezahl → sieht offene Summe live → zahlt korrekten Betrag
- Keine statischen Stripe-Payment-Links mehr (die das Anzahlungs-Problem hatten)

---

## Teil 2 — Mail-Vorschauen v3 (für Rigshospitalet)

Zwei HTML-Vorschauen aktualisieren/erzeugen in `/mnt/documents/`:

1. **`vorschau-rigshospitalet-bestaetigung.html`** — bleibt inhaltlich gleich (enthält keinen Restzahlungs-Link). Nur zur erneuten Ausgabe.

2. **`vorschau-rigshospitalet-restzahlung_v3.html`** — basierend auf v2, mit folgenden Änderungen:
   - Button-URL: `https://buy.stripe.com/...` → `https://events-storia.de/restzahlung/rigshospitalet`
   - Fallback-Link unter dem Button: gleicher Tausch
   - Erklärtext DE: „Die Seite berechnet automatisch **70,00 € × Anzahl Gäste − 490,00 € Anzahlung** und zeigt Ihnen den exakten Restbetrag, bevor Sie bezahlen."
   - Erklärtext EN: analoge englische Version
   - Alles andere (Layout, Tabellen, Stornobedingungen, DE/EN-Trenner, EN-Hinweis oben) bleibt 1:1

Beide Dateien werden anschließend als `<presentation-artifact>` ausgegeben.

---

## Reihenfolge bei der Umsetzung

1. Mail-Vorschauen v3 erzeugen (schnell, isoliert)
2. Migration: Trigger / Helper-Function für Auto-Anlage in `balance_payment_links`
3. `create-balance-payment-link` & `send-payment-email` & `send-scheduled-reminders` umstellen auf Slug-basierten Link bei `stripe_prepay`
4. Smoke-Test mit Rigshospitalet-Daten

## Nicht enthalten
- Keine Änderung an „Stripe – sofort" (Anzahlung) — die bleibt klassischer Stripe-Link
- Keine Änderung an Vor-Ort / Rechnung-nach-Event
- Keine UI-Änderung in der Inquiry
- Keine Maestro-Logik-Änderung
