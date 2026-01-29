
# Umfassender Plan: Event-Anfrage-Button, Checkout-Logik & Design-Review

## Zusammenfassung

Dieses Update erweitert die Events-Seite um einen zweiten Button für individuelle Angebote, optimiert die Checkout-Logik für Event-Pakete und harmonisiert das Admin-Design zu einem einheitlichen, professionellen Look.

---

## Teil 1: "Angebot erhalten" Button auf der Events-Seite

### Aktueller Zustand
- `EventPackageShopCard.tsx` zeigt nur den roten "Zum Warenkorb" Button
- Das `EventContactForm` existiert bereits unten auf der Seite, ist aber nicht paketspezifisch

### Lösung: Zweiter Button mit Modal-Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  [PAKET-KARTE]                                                  │
│                                                                 │
│  Business Dinner – Exclusive                                    │
│  99€ p.P.                                                       │
│                                                                 │
│  Gäste: [–] 35 [+]                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         🛒 Zum Warenkorb                                 │   │  ← Rot (Primary)
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         📩 Angebot erhalten                             │   │  ← Weiß (Outline)
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Klick auf "Angebot erhalten" öffnet Dialog

```text
┌─────────────────────────────────────────────────────────────────┐
│ × INDIVIDUELLES ANGEBOT                                         │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Paket: Business Dinner – Exclusive                          │ │
│ │ (kann im Gespräch noch geändert werden)                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Schritt 1/2: Event-Details                                      │
│                                                                 │
│ Gewünschtes Datum *        Uhrzeit                             │
│ ┌───────────────────┐     ┌───────────────────┐                │
│ │ 📅 12.03.2026     │     │ 🕐 19:00          │                │
│ └───────────────────┘     └───────────────────┘                │
│                                                                 │
│ Anzahl Gäste *                                                  │
│ ┌───────────────────┐                                          │
│ │ 35                │                                          │
│ └───────────────────┘                                          │
│                                                                 │
│                    [Weiter →]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ × INDIVIDUELLES ANGEBOT                                         │
│                                                                 │
│ Schritt 2/2: Kontaktdaten                                       │
│                                                                 │
│ Firma *                    Ansprechpartner *                    │
│ ┌───────────────────┐     ┌───────────────────┐                │
│ │ Mueller GmbH      │     │ Max Müller        │                │
│ └───────────────────┘     └───────────────────┘                │
│                                                                 │
│ E-Mail *                   Telefon                              │
│ ┌───────────────────┐     ┌───────────────────┐                │
│ │ max@mueller.de    │     │ +49 89 123456     │                │
│ └───────────────────┘     └───────────────────┘                │
│                                                                 │
│ Nachricht (optional)                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Besondere Wünsche, Allergien, Fragen...                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ☑ Ich möchte über exklusive Angebote informiert werden         │
│                                                                 │
│        [← Zurück]          [📩 Anfrage senden]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technische Umsetzung

**Neue Komponente: `EventPackageInquiryDialog.tsx`**

- 2-Schritt-Wizard im Dialog
- Schritt 1: Datum, Uhrzeit, Gästezahl (vorausgefüllt aus Karte)
- Schritt 2: Kontaktdaten (Firma, Name, E-Mail, Telefon, Nachricht)
- Speichert in `event_inquiries` Tabelle mit `source: 'package_inquiry'`
- Sendet Benachrichtigung via bestehender Edge Function

**Änderungen in `EventPackageShopCard.tsx`:**

```typescript
// Neuer State
const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);

// Neuer Button nach dem Warenkorb-Button
<Button 
  variant="outline"
  onClick={() => setInquiryDialogOpen(true)}
  className="w-full gap-2"
  size="lg"
>
  <Mail className="h-5 w-5" />
  {language === 'de' ? 'Angebot erhalten' : 'Get Quote'}
</Button>

<EventPackageInquiryDialog
  open={inquiryDialogOpen}
  onOpenChange={setInquiryDialogOpen}
  packageId={pkg.id}
  packageName={name}
  initialGuestCount={guestCount}
  pricePerPerson={pkg.price}
/>
```

---

## Teil 2: Checkout-Logik für Event-Pakete

### Problem
Event-Pakete sind "im Restaurant" und können nicht zur Abholung angeboten werden.

### Lösung: Automatische Erkennung & UI-Anpassung

**Erkennung eines Event-Pakets:**

```typescript
// In Checkout.tsx
const hasEventPackage = items.some(item => item.id.startsWith('event-'));
const isEventOnly = items.every(item => item.id.startsWith('event-'));
```

**UI-Anpassung:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ EVENT-BUCHUNG                                                   │
│                                                                 │
│ ℹ️ Ihr Event findet im STORIA statt.                           │
│    Keine Lieferung/Abholung erforderlich.                       │
│                                                                 │
│ Gewünschtes Datum *        Uhrzeit *                            │
│ ┌───────────────────┐     ┌───────────────────┐                │
│ │ 📅 12.03.2026     │     │ 🕐 19:00          │                │
│ └───────────────────┘     └───────────────────┘                │
│                                                                 │
│ ⚠️ Lieferoptionen sind für Events im Restaurant nicht          │
│    verfügbar und werden ausgeblendet.                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Änderungen in `Checkout.tsx`:**

1. Neue Variable `isEventBooking` erkennt Event-Pakete
2. `deliveryType` wird automatisch auf `'event'` gesetzt
3. Lieferungs-/Abholungssektion wird komplett ausgeblendet
4. Adressfelder werden ausgeblendet (Event ist im Restaurant)
5. Event-spezifische Info-Box wird angezeigt
6. Checkout erstellt Eintrag in `event_bookings` statt `catering_orders`

### Datenfluss

```text
[Kunde wählt Event-Paket]
         │
         ▼
[Zum Warenkorb hinzufügen]
  - category: 'equipment'
  - id: 'event-{uuid}'
         │
         ▼
[Checkout erkennt Event]
  - isEventBooking = true
  - Keine Lieferoptionen
  - Nur Datum/Zeit/Kontakt
         │
         ▼
[Bezahlung via Stripe]
         │
         ▼
[Speichern in event_bookings]
  - status: 'menu_pending'
  - payment_status: 'paid'
         │
         ▼
[Admin konfiguriert Menü]
  - EventBookingEditor
```

---

## Teil 3: Umfassende Design-Harmonisierung

### Frontend (Events-Seite) - Status: ✅ Gut

Die Events-Seite folgt bereits dem 2026-Standard:
- Glasmorphism-Hero
- Moderne Karten mit Hover-Effekten
- Responsive Grid
- Trust-Bar

### Backend (Admin) - Status: ⚠️ Verbesserungen nötig

**Aktuelle Probleme:**

1. **Bunte Badges**: Grün, Gelb, Rot für Status-Badges
2. **Inkonsistente Farben**: Verschiedene Amber/Green/Red-Töne
3. **Zu viele Akzentfarben**: Ablenkend und unprofessionell

**Lösung: Monochrome Status-Badges + Subtile Akzente**

```text
VORHER (zu bunt)                    NACHHER (professionell)
─────────────────                   ────────────────────────

🟢 Bezahlt                         ✓ Bezahlt (muted)
🟡 Menü offen                      ○ Menü offen (outline)
🔴 Storniert                       ✕ Storniert (outline red)

Badges:
bg-green-500                       → bg-muted text-foreground
bg-amber-500                       → border border-muted
bg-red-500                         → variant="destructive"
```

**Änderungen:**

| Komponente | Vorher | Nachher |
|------------|--------|---------|
| `FloatingPillNav.tsx` | `bg-amber-500` Badge | `bg-primary/10 text-primary` |
| `EventBookingsList.tsx` | Grün/Amber Icons | Monochrome `bg-muted` |
| `Dashboard.tsx` | Farbige Stats-Icons | Einheitlich `text-primary` |
| Status-Badges generell | Farbige Backgrounds | Outline + subtile Farben |

### Spezifische Änderungen

**1. FloatingPillNav.tsx (Zeilen 45-57 & 91-99):**

```typescript
// Vorher
"bg-amber-500 text-white"

// Nachher
"bg-primary text-primary-foreground"
```

**2. Dashboard.tsx Stats-Cards:**

```typescript
// Vorher
<AlertCircle className="h-4 w-4 text-amber-500" />
<Clock className="h-4 w-4 text-blue-500" />
<CalendarDays className="h-4 w-4 text-green-500" />

// Nachher (einheitlich)
<AlertCircle className="h-4 w-4 text-muted-foreground" />
<Clock className="h-4 w-4 text-muted-foreground" />
<CalendarDays className="h-4 w-4 text-primary" />
```

**3. EventBookingsList.tsx:**

```typescript
// Vorher
'bg-green-100 text-green-600'
'bg-amber-100 text-amber-600'

// Nachher
'bg-primary/10 text-primary'
'bg-muted text-muted-foreground'
```

---

## Dateiänderungen

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| `src/components/events/EventPackageInquiryDialog.tsx` | 2-Schritt Anfrageformular-Dialog |

### Zu modifizierende Dateien

| Datei | Änderungen |
|-------|------------|
| `EventPackageShopCard.tsx` | + "Angebot erhalten" Button, Dialog-Integration |
| `Checkout.tsx` | Event-Erkennung, UI-Ausblendung, Event-Flow |
| `FloatingPillNav.tsx` | Badge-Farben harmonisieren |
| `Dashboard.tsx` | Icon-Farben vereinheitlichen |
| `EventBookingsList.tsx` | Status-Farben anpassen |
| `CartContext.tsx` | Optional: `isEvent` Flag in CartItem |

---

## Implementierungsreihenfolge

### Phase 1: "Angebot erhalten" Button (Priorität: Hoch)
1. `EventPackageInquiryDialog.tsx` erstellen
2. `EventPackageShopCard.tsx` erweitern
3. Backend-Integration (nutzt bestehende `event_inquiries` Tabelle)

### Phase 2: Checkout-Logik (Priorität: Hoch)
1. Event-Erkennung in `Checkout.tsx`
2. UI-Ausblendung für Lieferoptionen
3. Event-spezifische Info-Box
4. Speicherung in `event_bookings` statt `catering_orders`

### Phase 3: Design-Harmonisierung (Priorität: Mittel)
1. Badge-Farben in Navigation
2. Dashboard Stats vereinheitlichen
3. Listen-Komponenten anpassen
4. Globale Farbdefinition prüfen

---

## Vorteile

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| Anfrage-Flow | Scrollen zum Formular | Direkter Dialog am Paket |
| Paket-Kontext | Geht verloren | Automatisch vorausgefüllt |
| Checkout für Events | Verwirrt mit Lieferoptionen | Klarer Event-Flow |
| Admin-Design | Zu bunt, unruhig | Professionell, fokussiert |
| UX-Konsistenz | Inkonsistent | State of the Art 2026 |

---

## Technische Details

### Event-Erkennung im Checkout

```typescript
// Neue Logik in Checkout.tsx
const isEventBooking = useMemo(() => {
  return items.some(item => item.id.startsWith('event-'));
}, [items]);

// Automatisch deliveryType setzen
useEffect(() => {
  if (isEventBooking) {
    setFormData(prev => ({ ...prev, deliveryType: 'event' }));
  }
}, [isEventBooking]);
```

### Dialog-Formular Validierung

```typescript
const inquirySchema = z.object({
  date: z.date({ required_error: "Datum erforderlich" }),
  time: z.string().min(1, "Uhrzeit erforderlich"),
  guestCount: z.number().min(10, "Mindestens 10 Gäste"),
  company: z.string().min(2, "Firmenname erforderlich"),
  name: z.string().min(2, "Name erforderlich"),
  email: z.string().email("Ungültige E-Mail"),
  phone: z.string().optional(),
  message: z.string().max(2000).optional(),
});
```

### Refine-Integration

Der Admin-Bereich nutzt Refine für:
- Datenlisten (Events, Bookings, Orders)
- CRUD-Operationen
- Authentifizierung

Die neuen Komponenten integrieren sich nahtlos in diese Architektur.
