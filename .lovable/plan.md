
# Event-Buchungen in die richtige Tabelle speichern

## Problem
Bei direkten Event-Paket-Buchungen über den Shop (z.B. "Business Dinner – Exclusive" für 2.970 €) werden die Daten in die falsche Tabelle `catering_orders` geschrieben statt in `event_bookings`.

**Betroffene Bestellung:**
- Bestellnummer: `EVENTS-ANGEBOT-29-01-2026-851`
- Paket: Business Dinner – Exclusive (30 Gäste × 99 €)
- Betrag: 2.970 €
- Problem: In `catering_orders` statt `event_bookings` gespeichert

---

## Ursache
Die `handleSubmit` Funktion in `Checkout.tsx` (Zeile 789) verwendet **immer** die `catering_orders` Tabelle – unabhängig davon ob `isEventBooking = true` ist.

---

## Technische Lösung

### Checkout.tsx: Bedingte Tabellen-Insertion

Der Code wird so angepasst, dass bei `isEventBooking === true` die Daten in die `event_bookings` Tabelle geschrieben werden:

```text
┌─────────────────────────────────────────────────────────────┐
│                    handleSubmit()                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   if (isEventBooking) {                                      │
│     ├── Insert in: event_bookings                           │
│     ├── Felder: booking_number, customer_name, event_date,  │
│     │           guest_count, package_id, total_amount, etc. │
│     └── Kein delivery_address, keine Lieferkosten           │
│   } else {                                                   │
│     ├── Insert in: catering_orders                          │
│     └── Felder: order_number, delivery_address, etc.        │
│   }                                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Feldmapping: catering_orders → event_bookings

| catering_orders | event_bookings | Hinweis |
|-----------------|----------------|---------|
| `order_number` | `booking_number` | Gleiche Nummer, anderer Feldname |
| `customer_name` | `customer_name` | ✓ |
| `customer_email` | `customer_email` | ✓ |
| `customer_phone` | `phone` | Anderer Feldname |
| `company_name` | `company_name` | ✓ |
| `desired_date` | `event_date` | Anderer Feldname |
| `desired_time` | `event_time` | Anderer Feldname |
| `items[0].quantity` | `guest_count` | Aus Item-Menge extrahieren |
| `items[0].id` | `package_id` | Ohne "event-" Präfix |
| `total_amount` | `total_amount` | ✓ |
| `payment_method` | – | Nicht in event_bookings (LexOffice/Stripe-Felder existieren) |
| `payment_status` | `payment_status` | ✓ |
| `notes` | `internal_notes` | Anderer Feldname |
| `user_id` | – | Nicht vorhanden in event_bookings |

### Zusätzliche Event-spezifische Felder

| Feld | Wert |
|------|------|
| `status` | `'menu_pending'` (Menü-Auswahl steht noch aus) |
| `menu_confirmed` | `false` |
| `menu_selection` | `null` (wird später im Admin ausgefüllt) |

---

## Änderungen in Checkout.tsx

### 1. Neue Funktion: extractEventBookingData()

Hilfsfunktion zum Extrahieren der Event-spezifischen Daten aus dem Warenkorb:
- `guest_count`: Aus der Item-Quantity
- `package_id`: Aus der Item-ID (ohne `event-` Präfix)

### 2. handleSubmit() anpassen (ca. Zeile 784-825)

Bedingte Insertion basierend auf `isEventBooking`:

**Für Event-Buchungen:**
```typescript
await supabase.from('event_bookings').insert({
  id: bookingId,
  booking_number: newOrderNumber,
  customer_name: formData.name,
  customer_email: formData.email,
  phone: formData.phone,
  company_name: formData.company || null,
  event_date: formData.date,
  event_time: formData.time || null,
  guest_count: eventItem.quantity,
  package_id: eventItem.id.replace('event-', ''),
  total_amount: grandTotal,
  payment_status: paymentMethod === 'stripe' ? 'pending' : 'pending',
  status: 'menu_pending',
  menu_confirmed: false,
  internal_notes: fullNotes || null,
});
```

### 3. Email-Notification anpassen

Die Edge Function `send-order-notification` muss erkennen, ob es sich um eine Event-Buchung handelt, um entsprechende Email-Texte zu verwenden.

### 4. LexOffice-Integration anpassen

`create-lexoffice-invoice` erhält Parameter `isEventBooking: true`, damit:
- Das richtige Nummernformat verwendet wird
- Der Dokumenttitel "Event-Buchungsbestätigung" lautet

---

## Betroffene Dateien

1. **`src/pages/Checkout.tsx`** – Hauptänderung: Bedingte Tabellen-Insertion
2. **`supabase/functions/send-order-notification/index.ts`** – Event-spezifische Email-Texte
3. **`supabase/functions/create-lexoffice-invoice/index.ts`** – Event-Buchungs-Erkennung (teilweise bereits implementiert)

---

## Hinweis zur bestehenden Bestellung

Die fehlerhafte Bestellung `EVENTS-ANGEBOT-29-01-2026-851` kann manuell in die richtige Tabelle migriert werden, nachdem der Fix implementiert ist.
