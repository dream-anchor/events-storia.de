## Problem

Ein statischer Stripe Payment Link kann nicht rechnen: `Gäste × Preis − fixe Anzahlung`. Stripe zeigt entweder `Menge × Stückpreis` (ohne Anzahlung abzuziehen) oder einen fixen Betrag (ohne Mengenwahl). Beides ist falsch.

## Formel (gilt für alle Kunden)

```text
offen = guests × price_per_person − deposit_paid
```

- Anzahlung wird **genau einmal** abgezogen (fix), nicht pro Person
- Mehr Gäste = mehr offen (linear)
- Beispiel A: 10 €/P, 10 € Anzahlung → 11 Gäste = 100 €
- Beispiel Rigshospitalet: 70 €/P, 490 € Anzahlung → 70 Gäste = 4.410 €, 75 Gäste = 4.760 €

## Generische Lösung

### 1. Neue Tabelle `balance_payment_links` (Maestro = Quelle der Wahrheit)

Spalten:
- `slug` (URL-Kürzel, unique, z. B. `rigshospitalet`)
- `event_label` (Anzeigename, z. B. „Event Christina Byrne Windfeld – 28.08.2026")
- `price_per_person_cents` (int, 1:1 aus Maestro)
- `deposit_paid_cents` (int, 1:1 aus Maestro)
- `min_guests`, `max_guests` (int)
- `default_guests` (int, Vorbelegung)
- `customer_email`, `customer_name`
- `event_id` (FK auf v2_events, optional)
- `active` (bool), `created_at`, `created_by`

RLS: Admins manage; anon kann nur per `slug` SELECT wenn `active = true`.

### 2. Edge Function `create-balance-checkout`

- Input: `{ slug, guests }`
- Lädt Zeile aus `balance_payment_links` (server-side, anon-safe)
- Validiert `min_guests ≤ guests ≤ max_guests`
- Berechnet `amount_cents = guests × price_per_person_cents − deposit_paid_cents`
- Erzeugt Stripe Checkout Session (`mode: payment`, EUR, `customer_email` vorbelegt)
- Loggt Eintrag in `v2_payments` (status `sent`) + `activity_logs`
- Antwort: `{ url }` → Client redirected
- **Keine** Client-Berechnung als Quelle — Edge Function rechnet immer aus DB

### 3. Public Page `/restzahlung/:slug` (DE/EN, gleiches Premium-UI)

Inhalt:
- Storia-Logo + Event-Label
- Karte mit Eingabefeld „Anzahl Gäste" (Default = `default_guests`, +/− Buttons, Range geclamped)
- Live-Anzeige der Formel:
  - `Gäste × 70,00 € = 4.900,00 €`
  - `− Anzahlung 490,00 €`
  - `= 4.410,00 € offen`
- Button „Jetzt sicher bezahlen" → ruft Edge Function → Redirect zu Stripe
- Hinweis: „Die endgültige Gästezahl wird 10 Tage vor dem Event bestätigt"
- DE/EN-Toggle oder beide Sprachen untereinander (konsistent zu Public-Offer-Seiten)

### 4. Admin-UI: „Restzahlungs-Link erstellen"

Kleines Dialog-Formular in Inquiry-Detail (oder eigenständig unter `/admin/balance-links`):
- Slug (auto aus Event-Name vorgeschlagen, editierbar)
- Event-Label, Preis/Person, Anzahlung, min/max/default Gäste, Kunde
- Speichern erzeugt Zeile + zeigt fertigen Link `https://events-storia.de/restzahlung/<slug>` zum Kopieren

### 5. Seed-Eintrag Rigshospitalet

`slug=rigshospitalet`, 7000 ¢/Person, 49000 ¢ Anzahlung, min=70, max=200, default=70, Kunde Christina Byrne Windfeld

### 6. E-Mail-Update (`vorschau-rigshospitalet-restzahlung_v3.html`)

- Stripe-Button-URL → `https://events-storia.de/restzahlung/rigshospitalet`
- Text: „Bitte Gästezahl prüfen, dann sicher per Karte / SEPA / Apple Pay zahlen"
- Trenner und EN-Hinweis oben bleiben unverändert

## Was NICHT angefasst wird

- Maestro-Preis-Logik, OfferBuilder, bestehende Payment-Flows
- Andere Public-Offer-Seiten
- Statischer Stripe Payment Link (wird für diesen Use Case nicht mehr genutzt)
