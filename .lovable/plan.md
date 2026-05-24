## Übersicht

Mehrere zusammenhängende Erweiterungen für das Maestro-Admin-System (Bestellungen + Anfragen). Aufgeteilt in 7 Arbeitspakete.

---

### 1. Mobile Nicht-Kritisch-Fixes (Quick Wins)

- **Tab-Scroll-Hint** in `SmartInquiryEditor`: rechter Fade-Gradient (`bg-gradient-to-l from-background`) als visueller Hinweis auf horizontales Scrollen.
- **Dashboard-Listenitems** ("Di·19:00 / Mi·18:30"): Layout in `AdminDashboard` überarbeiten — Initialen-Avatar links, Titel + Datum/Uhrzeit untereinander, statt gestapelter Index-Zahlen.
- **Status-Pills monochrom**: "Angebot gesendet" (grün) und "In Bearbeitung" (gelb) auf neutrale Grautöne umstellen (Memory: `monochrome-aesthetic-standards`).

---

### 2. Storno mit KI-Nachricht

- In `CateringOrderEditor` / `EventBookingEditor`: bei Statuswechsel auf "Storniert" öffnet sich Dialog mit:
  - Textarea für persönliche Nachricht
  - Button "Mit KI ausformulieren" → Edge Function `ai-cancellation-message` (Lovable AI Gateway, `google/gemini-2.5-flash`)
  - Prompt-Kontext: Kundenname, Bestellnummer, Datum, Grund-Stichworte des Admins
  - Resultat editierbar, dann "Senden & Stornieren" → Email via `send-transactional-email` + Status-Update
- Gleiche Logik für **Anfragen** ("Anfrage absagen") in `SmartInquiryEditor`.

---

### 3. Resend- & Stripe-Deep-Links in allen Aktivitäts-Timelines

- `Timeline.tsx` + `EmailStatusCard.tsx` + Activity-Logs erweitern um Icon-Links:
  - **E-Mail-Events**: Link zu `https://resend.com/emails/{resend_id}` (sofern `resend_id` gespeichert)
  - **Payment-Events**: Link zu `https://dashboard.stripe.com/payments/{payment_intent_id}` bzw. `/checkout/sessions/{session_id}`
- Migration: Sicherstellen, dass `resend_id`, `stripe_payment_intent_id`, `stripe_session_id` in `activity_log` / `email_log` / `payments` gespeichert werden (Spalten existieren teils schon, prüfen & ggf. ergänzen).
- Einheitliche `<ExternalRefLinks>`-Komponente für konsistente Darstellung überall (Bestellungen, Anfragen, Email-History, CRM-Activity).

---

### 4. Bezahlt-/Offen-Übersicht + Nachzahlungslink

- In `CateringOrderEditor` / `EventBookingEditor` neue Sektion **"Zahlungsstand"**:
  - Bereits bezahlt: Σ erfolgreicher Stripe-Charges (aus `payments` Tabelle)
  - Aktuelle Gesamtsumme (nach Änderungen)
  - **Offener Betrag** = Gesamt − Bezahlt (farblich hervorgehoben)
- Bei offener Differenz > 0: Button **"Zahlungslink senden"**
  - Edge Function `create-balance-payment-link`: erstellt Stripe Checkout Session über Restbetrag, verknüpft mit Order-ID in `metadata`
  - Versendet Email-Template `balance-payment-request` mit Link
  - Webhook updated `payments` + Status nach erfolgreicher Zahlung
- Anzeige in Aktivitäts-Timeline mit Stripe-Deep-Link (siehe Punkt 3).

---

### 5. Abweichende Rechnungs-/Lieferadresse

- DB-Migration: neue Spalten `billing_address` (jsonb) auf `catering_orders`, `event_bookings`, `inquiries` — wenn `null`, gilt Lieferadresse = Rechnungsadresse.
- UI in `AddressSection`: Checkbox "Abweichende Rechnungsadresse" → blendet zweites Adressformular ein (gleiche Struktur: Straße, PLZ, Ort, Etage, Aufzug, Hinweise).
- LexOffice-Integration (`lexoffice-create-invoice`): nutzt `billing_address ?? delivery_address`.
- Gilt für Bestellungen **und** Anfragen.

---

### 6. Kundenkonto per Einladungs-Email

- DB: `profiles` + `user_roles` Tabellen prüfen (existieren laut Memory).
- Edge Function `invite-customer-account`:
  - Input: customer_email, customer_name, related_inquiry_id/order_id
  - Verwendet `supabase.auth.admin.inviteUserByEmail()` mit `redirectTo: /set-password`
  - Erstellt vorab `profiles`-Eintrag mit Daten aus Bestellung/Anfrage
  - Versendet Branded-Email "Ihr persönlicher Kundenbereich" (Template `customer-account-invitation`)
- UI: Button "Kundenkonto einladen" in `CustomerSection` von:
  - `CateringOrderEditor`
  - `EventBookingEditor`
  - `SmartInquiryEditor`
  - Kundenliste/CRM-Detail
- Status-Anzeige: "Eingeladen am …" / "Aktiviert am …" / "Kein Konto"
- Neue Seite `/kundenbereich` (Login + Übersicht eigener Bestellungen/Rechnungen) als Folge-Arbeitspaket (optional Phase 2, hier nur Einladungs-Flow).

---

### 7. Anfragen-Parität

Folgende Features werden auch in `SmartInquiryEditor` / `InquiryEditor` gespiegelt:

| Feature | Bestellung | Anfrage |
|---|---|---|
| Storno mit KI-Nachricht | ✓ | ✓ ("Absage") |
| Resend/Stripe Deep-Links | ✓ | ✓ |
| Bezahlt/Offen-Übersicht | ✓ | nur wenn Anzahlung erfasst |
| Zahlungslink senden | ✓ | ✓ (für Anzahlung/Reservierung) |
| Alt. Rechnungsadresse | ✓ | ✓ |
| Kundenkonto einladen | ✓ | ✓ |

---

## Technische Notizen

- **Edge Functions neu**: `ai-cancellation-message`, `create-balance-payment-link`, `invite-customer-account`
- **Edge Functions erweitern**: `lexoffice-create-invoice` (billing_address-Fallback), `stripe-webhook` (Balance-Payments)
- **DB-Migrationen**: `billing_address` (3 Tabellen), ggf. `resend_id` / `stripe_*_id` Spalten in `activity_log`, Kundenkonto-Status-Spalte
- **Email-Templates neu**: `order-cancellation`, `balance-payment-request`, `customer-account-invitation` (alle Brutto-Preise, Signatur-System lt. Memory)
- **Konsistente Komponenten**: `<ExternalRefLinks>`, `<PaymentBalanceCard>`, `<CancellationDialog>`, `<CustomerAccountInviteButton>`, `<AlternateBillingAddressFields>` — wiederverwendbar über Orders/Bookings/Inquiries
- **Memory-Compliance**: Monochrome Palette, Inline-Buttons (kein FAB), rounded-2xl, Inter, Offer-Immutability respektieren

---

## Reihenfolge

1. Mobile-Fixes (klein, schnell)
2. DB-Migrationen (billing_address, account-status, activity-log refs)
3. Shared Komponenten + Deep-Links
4. Bezahlt/Offen + Stripe-Balance-Flow
5. Kundenkonto-Einladung
6. Storno mit KI
7. Anfragen-Parität durchziehen

Frage vor Implementation: **Alle 7 Pakete in einem Rutsch, oder priorisiert? Falls priorisiert — welche zuerst?**
