
# Phase 4: Event-Booking-System & Multi-Offer Integration

## Ziel

Integration des Multi-Offer-Systems in den bestehenden SmartInquiryEditor und Erstellung des Buchungs-Workflows für bezahlte Events mit Menü-Konfiguration.

---

## Teil 1: Multi-Offer Integration in SmartInquiryEditor

### Aktuelle Situation
- `SmartInquiryEditor` nutzt Single-Package-Auswahl via `EventModules`
- `MultiOfferComposer` existiert als separate Komponente, ist aber nicht integriert
- Zwei verschiedene Workflows nicht verbunden

### Lösung: Modus-Umschaltung

Der Editor erhält einen Toggle zwischen:
- **Einfach-Modus** (bestehend): Ein Paket direkt auswählen und konfigurieren
- **Multi-Offer-Modus** (neu): Bis zu 5 Optionen mit Stripe-Zahlungslinks

```text
SmartInquiryEditor
├── Tab: Kalkulation
│   ├── [Einfaches Angebot] [Multi-Optionen]  ← Mode Toggle
│   │
│   ├── Einfach: EventModules (bestehend)
│   │   └── MenuComposer → FinalizePanel
│   │
│   └── Multi: MultiOfferComposer (neu integriert)
│       ├── OfferOptionCard × n
│       │   └── Integrierter MenuWorkflow pro Option
│       └── FinalizePanel für Multi-Optionen
│
└── Tab: Kommunikation (für Follow-ups)
```

### Dateianpassungen

**SmartInquiryEditor.tsx** - Erweitert um:
- State: `offerMode: 'simple' | 'multi'`
- Toggle-Button im Kalkulation-Tab
- Conditional Rendering: `EventModules` vs `MultiOfferComposer`
- Props-Weiterleitung an MultiOfferComposer

**OfferOptionCard.tsx** - Erweitert um:
- Integration des vollständigen `MenuWorkflow` statt Placeholder
- Collapse/Expand für MenuWorkflow pro Option
- Synchronisierung der MenuSelection mit Parent-State

---

## Teil 2: Event-Buchungs-Liste & Editor

### Neue Route: `/admin/bookings`

Zeigt bezahlte Event-Buchungen aus `event_bookings` Tabelle:

```text
┌────────────────────────────────────────────────────────────┐
│ EVENT-BUCHUNGEN                                            │
│                                                            │
│ [Alle] [Menü offen] [Bereit]  ← Filter                    │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ✅ BEZAHLT  │ #EVT-2026-0042                           │ │
│ │                                                        │ │
│ │ Mueller GmbH │ Business Dinner │ 12.03.2026           │ │
│ │ 35 Gäste │ 3.465,00 €                                  │ │
│ │                                                        │ │
│ │ Menü: ⚠️ Nicht konfiguriert         [Menü festlegen] │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Neue Komponente: EventBookingsList.tsx

| Feature | Beschreibung |
|---------|--------------|
| Datenquelle | `event_bookings` Tabelle |
| Filter | Status-Filter (menu_pending, ready, completed) |
| Spalten | Buchungsnummer, Kunde, Paket, Datum, Gäste, Betrag, Menü-Status |
| Aktionen | "Menü festlegen" → EventBookingEditor |

### Neue Komponente: EventBookingEditor.tsx

Read-only Buchungsdetails + Vollständiger MenuWorkflow:

```text
┌────────────────────────────────────────────────────────────┐
│ ← Zurück │ #EVT-2026-0042 │ ✅ Bezahlt                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ BUCHUNGSDETAILS (read-only)                            │ │
│ │                                                        │ │
│ │ Paket      Business Dinner – Exclusive                 │ │
│ │ Gäste      35 Personen                                 │ │
│ │ Datum      12. März 2026, 19:00 Uhr                    │ │
│ │ Location   Private Room                                │ │
│ │ Betrag     3.465,00 € (bezahlt)                        │ │
│ │                                                        │ │
│ │ Kunde      Max Müller, Mueller GmbH                    │ │
│ │ E-Mail     max@mueller-gmbh.de                         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ MENÜ KONFIGURIEREN                                     │ │
│ │                                                        │ │
│ │ ┌──────────────────────────────────────────────────┐   │ │
│ │ │ 🍽️ Gänge │ 🍷 Getränke │ ✓ Bestätigen           │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ │                                                        │ │
│ │ ← Integration des bestehenden MenuWorkflow            │ │
│ │    (CourseSelector, DrinkPackageSelector)             │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │   [Menü speichern]   [Bestätigung an Kunden senden]   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Teil 3: Navigation & Routing Updates

### Neue Admin-Struktur

```text
/admin
├── /              Dashboard (angepasst für beide Workflows)
├── /events        Event-Anfragen (Leads → Angebote)
│   └── /:id/edit  SmartInquiryEditor (mit Multi-Offer)
├── /bookings      Event-Buchungen (bezahlt → Menü-Konfiguration)  ← NEU
│   └── /:id/edit  EventBookingEditor                              ← NEU
├── /orders        Catering-Bestellungen (Shop-Bestellungen)
├── /packages      Pakete verwalten
└── /menu          Speisekarte
```

### Navigation-Update (FloatingPillNav)

```text
[ 📊 Dashboard ] [ 📅 Anfragen (3) ] [ ✅ Buchungen (2) ] [ 📦 Bestellungen ] [ 🍽️ ]
                   └── event_inquiries   └── event_bookings   └── catering_orders
```

### Dateianpassungen

**RefineAdmin.tsx**:
- Neue Resource: `bookings` → `/admin/bookings`
- Neue Routen: 
  - `<Route path="bookings" element={<EventBookingsList />} />`
  - `<Route path="bookings/:id/edit" element={<EventBookingEditor />} />`

**AdminLayout.tsx**:
- Navigation erweitern um "Buchungen" mit Badge-Counter

**Dashboard.tsx**:
- Neue Kachel: "Buchungen ohne Menü" (menu_confirmed = false)
- Quick-Links zu Buchungen mit offener Menü-Konfiguration

---

## Teil 4: Bestätigungs-E-Mail nach Menü-Konfiguration

### Neue Edge Function: send-menu-confirmation

Wird aufgerufen wenn Mitarbeiter "Bestätigung senden" klickt:

```typescript
// Request
{
  bookingId: string;
  sendEmail: boolean;
}

// Ablauf
1. Lade Buchung mit menu_selection
2. Generiere E-Mail-Text mit Menü-Details (via AI)
3. Sende E-Mail an Kunden
4. Update booking: menu_confirmed = true
```

### E-Mail-Inhalt

```text
Betreff: Ihr Menü für [Event-Datum] steht fest

Sehr geehrte/r [Kunde],

vielen Dank für Ihre Buchung des [Paket-Name] am [Datum].

Wir haben folgendes Menü für Ihre Veranstaltung zusammengestellt:

🍽️ VORSPEISE
Vorspeisenplatte (hausgemacht)

🥩 HAUPTGANG
Tagliata di Manzo mit Rucola und Parmesan

🍰 DESSERT
Tiramisù nach Originalrezept

🍷 GETRÄNKE
Weinbegleitung (0,7l p.P.), Wasser, Kaffee

[Standard-Hinweise zu Allergien, Fleisch/Veggie-Auswahl etc.]

Mit freundlichen Grüßen,
STORIA
```

---

## Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/components/admin/refine/EventBookingsList.tsx` | Liste bezahlter Buchungen |
| `src/components/admin/refine/EventBookingEditor.tsx` | Buchungs-Details + MenuWorkflow |
| `src/hooks/useEventBookings.ts` | React Query Hooks für Buchungen |
| `supabase/functions/send-menu-confirmation/index.ts` | E-Mail nach Menü-Bestätigung |

## Zu modifizierende Dateien

| Datei | Änderungen |
|-------|------------|
| `SmartInquiryEditor.tsx` | Toggle Simple/Multi-Offer, Integration MultiOfferComposer |
| `OfferOptionCard.tsx` | Vollständiger MenuWorkflow statt Placeholder |
| `RefineAdmin.tsx` | Neue Routen für /bookings |
| `AdminLayout.tsx` | Navigation um "Buchungen" erweitern |
| `Dashboard.tsx` | Neue Kachel für Buchungen ohne Menü |
| `types/refine.ts` | EventBooking Interface |
| `index.ts` (exports) | Neue Komponenten exportieren |

---

## Implementierungsreihenfolge

1. **EventBookingsList + EventBookingEditor** erstellen
2. **useEventBookings Hook** für Daten-Fetching
3. **RefineAdmin Routing** erweitern
4. **AdminLayout Navigation** anpassen
5. **SmartInquiryEditor** mit Multi-Offer-Toggle
6. **OfferOptionCard** mit vollständigem MenuWorkflow
7. **send-menu-confirmation Edge Function**
8. **Dashboard** mit Buchungs-Widgets

---

## Datenfluss-Visualisierung

```text
                        ANFRAGEN                              BUCHUNGEN
                        ────────                              ─────────

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Anfrage    │     │   Angebot    │     │   Bezahlt    │     │   Bereit     │
│   kommt an   │────►│   erstellt   │────►│   via Stripe │────►│   für Event  │
│              │     │              │     │              │     │              │
│ event_       │     │ inquiry_     │     │ event_       │     │ event_       │
│ inquiries    │     │ offer_       │     │ bookings     │     │ bookings     │
│ status=new   │     │ options      │     │ menu=null    │     │ menu=done    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   Menü       │
                                          │   konfigu-   │
                                          │   rieren     │
                                          │              │
                                          │ EventBooking │
                                          │ Editor       │
                                          └──────────────┘
```
