
# Event-Buchungen in die richtige Tabelle speichern

## ✅ IMPLEMENTIERT

Bei direkten Event-Paket-Buchungen über den Shop werden die Daten jetzt korrekt in die `event_bookings` Tabelle geschrieben statt in `catering_orders`.

---

## Technische Änderungen

### 1. Checkout.tsx - Bedingte Tabellen-Insertion

Die `handleSubmit` Funktion prüft jetzt `isEventBooking` und speichert entsprechend:

```text
┌─────────────────────────────────────────────────────────────┐
│                    handleSubmit()                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   if (isEventBooking && eventItem) {                         │
│     ├── Insert in: event_bookings                           │
│     ├── booking_number, customer_name, event_date,          │
│     │   guest_count, package_id, total_amount, etc.         │
│     └── status: 'menu_pending', menu_confirmed: false       │
│   } else {                                                   │
│     ├── Insert in: catering_orders                          │
│     └── order_number, delivery_address, items, etc.         │
│   }                                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Feldmapping

| Catering | Event | Hinweis |
|----------|-------|---------|
| `order_number` | `booking_number` | Anderer Feldname |
| `customer_phone` | `phone` | Anderer Feldname |
| `desired_date` | `event_date` | Anderer Feldname |
| `desired_time` | `event_time` | Anderer Feldname |
| `items[0].quantity` | `guest_count` | Aus Menge extrahiert |
| `items[0].id` | `package_id` | Ohne 'event-' Präfix |
| `notes` | `internal_notes` | Anderer Feldname |

### 3. Email-Notifications (send-order-notification)

- Unterschiedliche Betreffzeilen für Events vs Catering
- Unterschiedliche Email-Texte (Veranstaltungsort statt Lieferadresse)
- Hinweis an Restaurant: "MENÜAUSWAHL ERFORDERLICH"

### 4. Order-Nummern-Format

- Event-Buchungen: `EVT-BUCHUNG-DD-MM-YYYY-XXX`
- Catering bezahlt: `CAT-BESTELLUNG-DD-MM-YYYY-XXX`
- Catering Angebot: `CAT-ANGEBOT-DD-MM-YYYY-XXX`

---

## Betroffene Dateien

1. ✅ `src/pages/Checkout.tsx` – Bedingte Tabellen-Insertion
2. ✅ `supabase/functions/send-order-notification/index.ts` – Event-spezifische Emails
3. ✅ `supabase/functions/create-lexoffice-invoice/index.ts` – Bereits implementiert
