
# Umfassendes Event-Buchungs- & Angebotssystem 2026

## Zusammenfassung

Dieses System vereinheitlicht zwei unterschiedliche Workflows in einem modernen, integrierten Admin-Erlebnis:

1. **Bestellungen (Paid Bookings)**: Kunden, die bereits bezahlt haben → Mitarbeiter konfiguriert das Menü
2. **Anfragen (Inquiries → Offers)**: Kunden stellen Anfragen → Mitarbeiter erstellt Multi-Paket-Angebote mit Stripe-Zahlungslinks

---

## Teil 1: Bestellungen – Bezahlte Paket-Buchungen

### Problemstellung

Aktuell zeigt die `OrdersList` nur Catering-Bestellungen aus dem Shop. Es gibt keinen Workflow für bezahlte Event-Pakete, bei denen der Mitarbeiter nachträglich die konkreten Speisen/Getränke festlegen muss.

### Lösung: Event-Bestellungs-Editor

```text
┌────────────────────────────────────────────────────────────────────┐
│ BESTELLUNGEN                                                       │
│                                                                    │
│ [Alle] [Catering] [Events]  ← Neue Filter-Option                  │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ ✅ BEZAHLT │ #EVT-2026-0042 │ Business Dinner                  │ │
│ │                                                                │ │
│ │ Kunde: Mueller GmbH │ 35 Gäste │ 12.03.2026                   │ │
│ │                                                                │ │
│ │ Menü: ⚠️ Nicht konfiguriert                                   │ │
│ │                                                                │ │
│ │ [Menü festlegen]                                               │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Workflow

```text
KUNDE                          SYSTEM                          MITARBEITER
  │                               │                                │
  ├─ Bucht Paket im Shop ────────►│                                │
  │                               │                                │
  ├─ Bezahlt via Stripe ─────────►│                                │
  │                               │                                │
  │                               ├─ Erstellt Event-Bestellung ───►│
  │                               │   (Status: paid, menu: null)   │
  │                               │                                │
  │                               │                       ◄────────┤ Öffnet Bestellung
  │                               │                                │
  │                               │                       ◄────────┤ Konfiguriert Menü
  │                               │                                │
  │◄── Bestätigungsmail ──────────│◄── Speichert Menü ────────────┤
  │    mit komplettem Menü        │                                │
  │                               │                                │
```

### Datenbank-Erweiterung

**Neue Tabelle: `event_bookings`**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primary Key |
| `booking_number` | TEXT | z.B. "EVT-2026-0042" |
| `customer_email` | TEXT | E-Mail des Kunden |
| `customer_name` | TEXT | Name |
| `company_name` | TEXT | Firma (optional) |
| `package_id` | UUID | → packages |
| `guest_count` | INT | Anzahl Gäste |
| `event_date` | DATE | Termin |
| `event_time` | TEXT | Uhrzeit |
| `location_id` | UUID | → event_locations |
| `menu_selection` | JSONB | Konfigurierte Gänge/Getränke |
| `menu_confirmed` | BOOLEAN | Vom Mitarbeiter bestätigt? |
| `total_amount` | NUMERIC | Gesamtbetrag |
| `payment_status` | TEXT | 'pending', 'paid', 'refunded' |
| `stripe_payment_intent_id` | TEXT | Stripe PI |
| `status` | TEXT | 'confirmed', 'menu_pending', 'ready' |
| `internal_notes` | TEXT | Interne Notizen |
| `created_at` | TIMESTAMPTZ | Erstellt |

### UI-Komponente: EventBookingEditor

```text
┌────────────────────────────────────────────────────────────────────┐
│ ← Zurück │ #EVT-2026-0042 │ ✅ Bezahlt                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ BUCHUNGSDETAILS                                                │ │
│ │                                                                │ │
│ │ Paket      Business Dinner – Exclusive                        │ │
│ │ Gäste      35 Personen                                        │ │
│ │ Datum      12. März 2026, 19:00 Uhr                           │ │
│ │ Location   Private Room                                        │ │
│ │ Betrag     3.465,00 € (inkl. MwSt.)                           │ │
│ │                                                                │ │
│ │ Kunde      Max Müller                                          │ │
│ │ Firma      Mueller GmbH                                        │ │
│ │ E-Mail     max@mueller-gmbh.de                                 │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ MENÜ KONFIGURIEREN                                             │ │
│ │                                                                │ │
│ │  [ 🍽️ Gänge ] [ 🍷 Getränke ] [ ✓ Bestätigen ]                │ │
│ │                                                                │ │
│ │  ← Integration des bestehenden MenuWorkflow                   │ │
│ │                                                                │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │       [Menü speichern & Bestätigung senden]                  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Teil 2: Anfragen – Multi-Paket-Angebotssystem mit Stripe-Links

### Problemstellung

Aktuell kann der Mitarbeiter nur ein Paket pro Angebot konfigurieren. Der Kunde soll aber mehrere Optionen (z.B. alle drei Pakete) zur Auswahl bekommen, jeweils mit eigenem Stripe-Zahlungslink.

### Lösung: Multi-Offer System mit Versionierung

```text
┌────────────────────────────────────────────────────────────────────┐
│ ANGEBOT ERSTELLEN                                                  │
│                                                                    │
│ Für: Mueller GmbH │ 35 Gäste │ 12.03.2026                         │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ PAKET-OPTIONEN                          [+ Option hinzufügen] │ │
│ │                                                                │ │
│ │ ┌────────────────────────────────────────────────────────────┐ │ │
│ │ │ ☑️ Option A: Network-Aperitivo                     69€ p.P. │ │ │
│ │ │                                                            │ │ │
│ │ │ [Menü konfigurieren]    Fingerfood + Pasta ✓              │ │ │
│ │ │                         Getränke ✓                         │ │ │
│ │ │                                                            │ │ │
│ │ │ Gesamt: 35 × 69€ = 2.415,00 €                             │ │ │
│ │ └────────────────────────────────────────────────────────────┘ │ │
│ │                                                                │ │
│ │ ┌────────────────────────────────────────────────────────────┐ │ │
│ │ │ ☑️ Option B: Business Dinner – Exclusive           99€ p.P. │ │ │
│ │ │                                                            │ │ │
│ │ │ [Menü konfigurieren]    Vorspeisenplatte ✓                │ │ │
│ │ │                         Hauptgang: Tagliata ✓             │ │ │
│ │ │                         Dessert: Tiramisù ✓               │ │ │
│ │ │                         Getränke ✓                         │ │ │
│ │ │                                                            │ │ │
│ │ │ Gesamt: 35 × 99€ = 3.465,00 €                             │ │ │
│ │ └────────────────────────────────────────────────────────────┘ │ │
│ │                                                                │ │
│ │ ┌────────────────────────────────────────────────────────────┐ │ │
│ │ │ □ Option C: Gesamte Location                      8.500€   │ │ │
│ │ │                                                            │ │ │
│ │ │ [Aktivieren für Angebot]                                   │ │ │
│ │ └────────────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Datenbank-Erweiterungen

**Neue Tabelle: `inquiry_offer_options`**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primary Key |
| `inquiry_id` | UUID | → event_inquiries |
| `offer_version` | INT | Versionsnummer (1, 2, 3...) |
| `package_id` | UUID | → packages |
| `option_label` | TEXT | "Option A", "Option B" |
| `guest_count` | INT | Anzahl Gäste |
| `menu_selection` | JSONB | Gänge + Getränke |
| `total_amount` | NUMERIC | Berechneter Preis |
| `stripe_payment_link_id` | TEXT | Stripe Payment Link ID |
| `stripe_payment_link_url` | TEXT | Zahlungs-URL |
| `is_active` | BOOLEAN | Aktiv in Angebot? |
| `created_at` | TIMESTAMPTZ | Erstellt |

**Erweiterung: `event_inquiries`**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `current_offer_version` | INT | Aktuelle Angebotsversion |
| `selected_option_id` | UUID | Gewählte Option nach Zahlung |

**Neue Tabelle: `inquiry_offer_history`**

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primary Key |
| `inquiry_id` | UUID | → event_inquiries |
| `version` | INT | Versionsnummer |
| `sent_at` | TIMESTAMPTZ | Versanddatum |
| `sent_by` | TEXT | Mitarbeiter-E-Mail |
| `email_content` | TEXT | Gespeicherter E-Mail-Text |
| `pdf_url` | TEXT | PDF in Storage |
| `options_snapshot` | JSONB | Snapshot der Optionen |

### Stripe Integration

**Neue Edge Function: `create-offer-payment-link`**

```typescript
// Erstellt einen Stripe Payment Link für jede Angebots-Option

interface CreatePaymentLinkRequest {
  inquiryId: string;
  optionId: string;
  packageName: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  eventDate: string;
  guestCount: number;
}

// Returns:
interface PaymentLinkResponse {
  paymentLinkId: string;
  paymentLinkUrl: string;
}
```

**Workflow:**

```text
1. Mitarbeiter fügt Option hinzu
   └─→ System erstellt Stripe Payment Link (nicht sofort)

2. Mitarbeiter klickt "Angebot senden"
   └─→ Für jede aktive Option:
       ├─→ Stripe Payment Link erstellen
       └─→ URL in inquiry_offer_options speichern

3. E-Mail wird generiert mit allen Optionen + Links:
   ┌─────────────────────────────────────────────────────┐
   │ Sehr geehrte Frau Müller,                          │
   │                                                     │
   │ anbei unser Angebot für Ihr Event am 12.03.2026:   │
   │                                                     │
   │ ═══════════════════════════════════════════════════ │
   │                                                     │
   │ OPTION A: Network-Aperitivo                        │
   │ Fingerfood, Live-Pasta-Station, Getränke-Pauschale │
   │ 35 Gäste × 69€ = 2.415,00 € (inkl. MwSt.)         │
   │                                                     │
   │ ► JETZT BUCHEN: [Zahlungslink Option A]            │
   │                                                     │
   │ ─────────────────────────────────────────────────── │
   │                                                     │
   │ OPTION B: Business Dinner – Exclusive              │
   │ Vorspeisenplatte, Tagliata di Manzo, Tiramisù     │
   │ 35 Gäste × 99€ = 3.465,00 € (inkl. MwSt.)         │
   │                                                     │
   │ ► JETZT BUCHEN: [Zahlungslink Option B]            │
   │                                                     │
   │ ═══════════════════════════════════════════════════ │
   │                                                     │
   │ Mit freundlichen Grüßen,                           │
   │ STORIA                                              │
   └─────────────────────────────────────────────────────┘

4. Kunde klickt auf gewünschten Link
   └─→ Stripe Checkout öffnet sich
       └─→ Nach Zahlung:
           ├─→ Webhook oder Polling erkennt Zahlung
           ├─→ `selected_option_id` wird gesetzt
           ├─→ Anfrage-Status → 'confirmed'
           └─→ Event-Buchung wird erstellt (event_bookings)
```

### Versionierung

```text
┌────────────────────────────────────────────────────────────────────┐
│ ANGEBOTS-HISTORIE                                    Version 2 ▼   │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ v2 │ Gesendet: 28.01.2026 14:32 │ von max@storia.de           │ │
│ │                                                                │ │
│ │ Änderungen: Option B Preis angepasst (99€ → 89€)              │ │
│ │                                                                │ │
│ │ [PDF ansehen] [Erneut senden]                                 │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ v1 │ Gesendet: 25.01.2026 10:15 │ von max@storia.de           │ │
│ │                                                                │ │
│ │ Ursprüngliches Angebot mit 2 Optionen                         │ │
│ │                                                                │ │
│ │ [PDF ansehen]                                                  │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Teil 3: Unified Editor – Multi-Option Composer

### Neue Komponente: `MultiOfferComposer`

Ersetzt den bisherigen Single-Package-Workflow:

```text
SmartInquiryEditor
└── MultiOfferComposer (NEU)
    ├── OfferOptionCard (für jede Option)
    │   ├── PackageSelector
    │   ├── MenuWorkflow (integriert)
    │   │   ├── CoursesPanel
    │   │   ├── DrinksPanel
    │   │   └── PreviewPanel
    │   └── PriceSummary
    ├── OfferSummaryPanel
    │   ├── AllOptionsSummary
    │   └── TotalBreakdown
    └── OfferActionsBar
        ├── GenerateEmailButton
        ├── PreviewPDFButton
        └── SendOfferButton
```

### State-Struktur

```typescript
interface OfferState {
  inquiryId: string;
  currentVersion: number;
  options: OfferOption[];
  emailDraft: string;
  notes: string;
}

interface OfferOption {
  id: string;
  packageId: string;
  packageName: string;
  optionLabel: string; // "A", "B", "C"
  isActive: boolean;
  guestCount: number;
  menuSelection: MenuSelection;
  totalAmount: number;
  stripePaymentLinkUrl: string | null;
}
```

---

## Teil 4: Navigation & UX 2026

### Unified Admin Experience

```text
┌────────────────────────────────────────────────────────────────────┐
│ [STORIA]  ┌───────────────────────────────────────┐   [Max M.] [⚙]│
│           │ 📊 │ 📅 Anfragen │ 📦 Buchungen │ 🍽️ │                │
│           └───────────────────────────────────────┘                │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ "Anfragen" = event_inquiries (Angebots-Workflow)                  │
│ "Buchungen" = event_bookings + catering_orders (Bezahlt)          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Status-Flow Visualisierung

```text
ANFRAGEN                          BUCHUNGEN
────────                          ─────────

┌─────────┐                      
│   Neu   │                      
└────┬────┘                      
     │                           
     ▼                           
┌─────────────┐                  
│ Kontaktiert │                  
└──────┬──────┘                  
       │                         
       ▼                         
┌────────────────┐               
│ Angebot v1     │──────┐       
└───────┬────────┘      │       
        │               │       
        ▼               │       
┌────────────────┐      │       
│ Angebot v2     │──────┤       
│ (Überarbeitet) │      │       
└───────┬────────┘      │       
        │               │       
        ▼               ▼       
┌────────────────┐  ┌─────────────────┐     ┌──────────────┐
│   Abgelehnt    │  │ Kunde bezahlt   │────►│ Buchung      │
└────────────────┘  │ via Stripe-Link │     │ erstellt     │
                    └─────────────────┘     └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Menü wird    │
                                            │ konfiguriert │
                                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Event        │
                                            │ finalisiert  │
                                            └──────────────┘
```

---

## Implementierungsplan

### Phase 1: Datenbank-Erweiterungen
1. Neue Tabelle `event_bookings` erstellen
2. Neue Tabelle `inquiry_offer_options` erstellen
3. Neue Tabelle `inquiry_offer_history` erstellen
4. Erweiterung `event_inquiries` um `current_offer_version`, `selected_option_id`
5. RLS-Policies für alle neuen Tabellen

### Phase 2: Stripe Payment Links
1. Edge Function `create-offer-payment-link` erstellen
2. Edge Function `handle-offer-payment-success` (Webhook oder Polling)
3. Integration mit bestehendem Stripe-Setup

### Phase 3: Multi-Offer Composer UI
1. `MultiOfferComposer` Hauptkomponente
2. `OfferOptionCard` mit integriertem MenuWorkflow
3. `OfferVersionHistory` für Versionierung
4. Update `SmartInquiryEditor` mit neuem Flow

### Phase 4: Buchungs-Workflow
1. `EventBookingsList` Komponente (oder Integration in OrdersList)
2. `EventBookingEditor` mit MenuWorkflow
3. E-Mail-Benachrichtigung nach Menü-Konfiguration

### Phase 5: PDF & E-Mail
1. PDF-Template für Multi-Option-Angebote
2. E-Mail-Template mit Stripe-Links
3. AI-Composer Update für Multi-Optionen

### Phase 6: Polish & Integration
1. Navigation-Update (Anfragen / Buchungen)
2. Dashboard-Widgets für beide Workflows
3. Benachrichtigungen bei Zahlungseingang

---

## Technische Details

### Stripe Payment Links vs. Checkout Sessions

**Payment Links (empfohlen für diesen Use Case):**
- Vorab erstellt, wiederverwendbar
- Keine serverseitige Session-Erstellung beim Klick
- Ideal für E-Mails mit mehreren Optionen
- Einfache Nachverfolgung über `metadata`

```typescript
// Stripe Payment Link erstellen
const paymentLink = await stripe.paymentLinks.create({
  line_items: [{
    price_data: {
      currency: 'eur',
      product_data: {
        name: `STORIA Event: ${packageName}`,
        description: `${guestCount} Gäste, ${eventDate}`,
      },
      unit_amount: Math.round(amount * 100),
    },
    quantity: 1,
  }],
  after_completion: {
    type: 'redirect',
    redirect: {
      url: `${origin}/booking-success?option=${optionId}`,
    },
  },
  metadata: {
    inquiry_id: inquiryId,
    option_id: optionId,
    package_id: packageId,
  },
});
```

### Webhook für Zahlungsbestätigung

```typescript
// Alternativ: Polling-basierter Ansatz ohne Webhook
// Prüft regelmäßig auf bezahlte Payment Links

// Oder: Stripe Webhook für payment_intent.succeeded
// Extrahiert metadata und aktualisiert Datenbank
```

---

## Vorteile

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| Paket-Optionen | 1 pro Angebot | 1-3 pro Angebot |
| Bezahlung | Manuell/extern | Direkt via Stripe-Link |
| Versionierung | Keine | Komplette Historie |
| Menü nach Zahlung | Nicht möglich | Vollständiger Workflow |
| Kundenerlebnis | E-Mail → Überweisung → Warten | E-Mail → Klick → Bezahlt |
| Mitarbeiter-Aufwand | Mehrere Systeme | Alles in einem Editor |

---

## Offene Entscheidungen

1. **Stripe Webhook vs. Polling**: Webhook ist zuverlässiger, erfordert aber zusätzliche Konfiguration
2. **PDF-Generierung**: Weiterhin via LexOffice oder eigenes Template?
3. **E-Mail-Versand**: Via LexOffice oder direkt via Resend/IONOS?
4. **Menü-Bestätigung**: Automatische E-Mail an Kunden nach Konfiguration?
