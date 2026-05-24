## Ziel

Für Events mit Vorab-Restzahlung per Kreditkarte (z. B. Christina Byrne Windfeld / Rigshospitalet) wird in der Bestätigungsmail ein Stripe Payment Link eingebettet. Der Kunde kann die finale Personenzahl selbst hochstellen – aber niemals **unter** die in Maestro hinterlegte Mindestanzahl gehen.

## Funktionsweise im Stripe-Checkout

- Stripe-Feature: `adjustable_quantity` auf dem Line Item.
- Preis wird als **Preis pro Person** (brutto, in Cent) angelegt.
- Default-Menge im Checkout = Mindestpersonenzahl aus Maestro.
- `minimum_adjustable_quantity` = Mindestpersonenzahl (Lock nach unten).
- `maximum_adjustable_quantity` = 999 (kein realistisches Limit nach oben, oder Wert aus „bis"-Feld + Puffer).
- Stripe berechnet automatisch: `unit_amount × quantity` = Gesamtbetrag.

## Änderungen in Maestro

### 1. Event-Details: Personenzahl von/bis
Im Event-Detail-Panel erscheint das bestehende „Personen"-Feld als **Personenzahl-Minimum**, neu daneben optional **„bis"** (`guest_count_max`).
- Berechnungsgrundlage für Angebote/Preise = Minimum.
- „bis"-Feld nur optional, dient als Info + Obergrenze im Stripe-Link.

### 2. Neuer Button im Event: „Stripe-Zahlungslink generieren"
Sichtbar im Zahlungsbereich des Events, sobald:
- ein gewähltes Angebot (`is_chosen=true`) mit `amount_total` und `guest_count` existiert,
- noch keine Anzahlung/Vollzahlung erfolgt ist.

Klick öffnet Dialog mit:
- Anzeige berechneter **Preis pro Person** (= `amount_total / guest_count` des Angebots),
- Vorbelegt: Min-Personen (aus Event), Max-Personen (optional),
- Optionale Beschreibung („Restzahlung Rigshospitalet"),
- Checkbox „Link direkt per Bestätigungsmail an Kunden senden" (Default an).

### 3. Edge Function `create-prepayment-link` (neu, oder Erweiterung von `create-balance-payment-link`)

Eingabe: `eventId`, `pricePerPersonCents`, `minGuests`, `maxGuests`, `description`, `sendEmail`.

Logik:
- Stripe Product + Price (`unit_amount = pricePerPersonCents`) anlegen
- Payment Link mit `line_items[0].adjustable_quantity = { enabled: true, minimum: minGuests, maximum: maxGuests }` und `quantity: minGuests`
- Metadata: `event_id`, `kind: "prepayment_per_person"`, `min_guests`, `price_per_person_cents`
- `v2_payments`-Record (`status='sent'`, `payment_type='balance_prepayment'`, `amount_cents = pricePerPersonCents * minGuests` als Erwartungswert, `stripe_payment_link_url`) anlegen
- Falls `sendEmail=true`: `send-payment-confirmation-v2` (bzw. neue Variante) mit Link-Block aufrufen, sonst nur Link zurückgeben

### 4. Bestätigungsmail mit Link
`send-payment-confirmation-v2` (bzw. eine vorgelagerte Vorab-Mail) wird um optionalen Block erweitert:

> „Sie können Ihre **finale Gästezahl** (mindestens **70**, gerne auch mehr) bequem selbst eingeben und direkt per Kreditkarte zahlen:
> [Jetzt Restbetrag begleichen →]
> Preis pro Gast: **70,00 €** (brutto, inkl. MwSt.)"

Der Block erscheint nur, wenn am Event ein aktiver Prepayment-Link existiert.

### 5. Stripe Webhook: Final-Personenzahl übernehmen
Bestehender `stripe-webhook` erweitern:
- Bei `checkout.session.completed` mit `metadata.kind='prepayment_per_person'`:
  - Aus Session `line_items[0].quantity` = finale Personenzahl ablesen,
  - `v2_events.guest_count` auf diesen Wert aktualisieren (nur wenn ≥ `guest_count_min`),
  - `v2_payments`: `status='paid'`, `amount_cents` = tatsächlich gezahlt, `paid_at` setzen,
  - Aktivitätslog: „Kunde hat 78 Gäste bestätigt und 5.460 € gezahlt",
  - Zwei Mails: **Bestätigung an Kunde** (mit gewählter Anzahl + Summe) und **Info an Operator** (info@events-storia.de) via Resend.

## Datenbankänderungen

Migration (Schema):
- `v2_events`: neue Spalte `guest_count_min integer` (optional, fällt auf `guest_count` zurück) und `guest_count_max integer NULL`.
- (Alternative: `guest_count` bleibt das Minimum, nur `guest_count_max` neu — minimal-invasiv. **Empfohlen.**)

## Technische Details

```text
create-prepayment-link (Edge Function)
  └─ Stripe.products.create
  └─ Stripe.prices.create { unit_amount: perPersonCents, currency: 'eur' }
  └─ Stripe.paymentLinks.create {
       line_items: [{
         price: priceId,
         quantity: minGuests,
         adjustable_quantity: { enabled: true, minimum: minGuests, maximum: maxGuests ?? 999 }
       }],
       metadata: { event_id, kind: 'prepayment_per_person', min_guests, price_per_person_cents }
     }
  └─ INSERT v2_payments (status='sent', payment_type='balance_prepayment', ...)
  └─ optional: invoke send-payment-confirmation-v2 (Variante "prepayment_invite")

stripe-webhook (Erweiterung)
  └─ on checkout.session.completed where metadata.kind = 'prepayment_per_person':
       - sessions.listLineItems(session.id)
       - finalGuests = lineItems[0].quantity
       - UPDATE v2_events SET guest_count = finalGuests WHERE id = event_id AND finalGuests >= guest_count
       - UPDATE v2_payments SET status='paid', amount_cents = session.amount_total, paid_at=now()
       - Resend Mail an Kunde + info@events-storia.de
```

## Offene Frage (kann während Build geklärt werden)

- Für Rigshospitalet ist aktuell **kein Angebot als `is_chosen=true` markiert** (nur Cyim hat ein gewähltes Angebot mit 35 €/Person). Soll ich für Rigshospitalet das existierende Angebot „A" (70 Gäste, 4.900 € → 70 €/Person) automatisch als Basis verwenden, oder soll Maestro vor Linkerstellung erzwingen, dass ein Angebot final markiert ist?

## Was NICHT geändert wird

- Vorhandene `payment_timing='on_site'`-Logik bleibt; der neue Link ist eine **zusätzliche Option**, kein Ersatz.
- Bestehende `create-balance-payment-link` (Fixbetrag) bleibt erhalten für andere Use-Cases.
