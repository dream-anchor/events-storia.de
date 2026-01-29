
# Audit-Ergebnis: Terminologie & Logik-Überprüfung

## Zusammenfassung

Nach eingehender Prüfung als **Web Tester + Red Team + Senior Developer** habe ich die gesamte Logik für Anfragen, Bestellungen, Events und Catering analysiert.

---

## ✅ Was KORREKT funktioniert

### 1. Terminologie-Logik (E-Mail Edge Function)
Die `send-order-notification` Edge Function verwendet jetzt korrekt `paymentStatus`:

| paymentStatus | Terminologie (Event) | Terminologie (Catering) |
|---------------|---------------------|------------------------|
| `paid` | "Event-Buchung" | "Bestellung" |
| `pending` | "Event-Anfrage" | "Anfrage" |

**Code-Beweis (Zeile 72-93):**
```typescript
const isPaid = data.paymentStatus === 'paid';
const isEvent = data.isEventBooking === true;

if (isEvent) {
  greeting = isPaid
    ? 'vielen Dank für Ihre Event-Buchung!'
    : 'vielen Dank für Ihre Event-Anfrage!';
}
```

### 2. Datenbank-Split Event vs Catering
Die Checkout-Logik trennt korrekt zwischen:
- **`event_bookings`** für Event-Pakete (item.id startet mit `event-`)
- **`catering_orders`** für normale Catering-Bestellungen

### 3. E-Mail bei Rechnung-Zahlung
Bei `paymentMethod: 'invoice'` wird sofort eine E-Mail mit `paymentStatus: 'pending'` gesendet → "Anfrage" (korrekt!)

---

## ⚠️ BUG #1: Stripe-Zahlung für Events (KRITISCH)

### Problem
Der `handlePaymentSuccess`-Handler (Zeile 339-380) sucht nur in `catering_orders`:

```typescript
const { data: orderData } = await supabase
  .from('catering_orders')  // ← NUR catering_orders!
  .select('*')
  .eq('order_number', orderNum)
  .single();
```

**Event-Buchungen mit Stripe werden NICHT gefunden**, da sie in `event_bookings` liegen.

### Auswirkung
- ❌ Keine LexOffice-Rechnung für bezahlte Events
- ❌ Keine E-Mail-Benachrichtigung nach Stripe-Zahlung für Events
- ❌ `payment_status` wird nicht auf `'paid'` aktualisiert

---

## ⚠️ BUG #2: isEventBooking fehlt im Stripe-Cache

### Problem
Der `orderDataForCache` (Zeile 969-990) enthält NICHT die Event-spezifischen Felder:

```typescript
const orderDataForCache = {
  orderId: orderId,
  orderNumber: newOrderNumber,
  // ...
  // FEHLT: isEventBooking, guestCount, eventPackageName
};
```

### Auswirkung
Nach Stripe-Redirect weiß das System nicht, dass es ein Event war → falsche Terminologie in E-Mails

---

## ⚠️ BUG #3: Falsche Bestellung in catering_orders

### Datenbankbefund
```
EVENTS-ANGEBOT-29-01-2026-851 | 2.970 € | payment_status: pending
```

Diese Bestellung hat ein `EVENTS-` Präfix, liegt aber in `catering_orders` statt `event_bookings`. Wahrscheinlich ein manueller Test oder Altlast.

---

## ⚠️ BUG #4: event_bookings-Tabelle ist leer

### Datenbankbefund
```sql
SELECT * FROM event_bookings LIMIT 5;
-- Ergebnis: [] (leer)
```

**Aber es gibt Event-Anfragen in `event_inquiries`:**
- Max Mustermann, 25 Gäste, 15.03.2026
- Valentina Kurkowski, 21-50 Gäste, 03.02.2026

Dies ist korrekt, da:
- `event_inquiries` = Kontaktformular-Anfragen (noch keine Bestellung)
- `event_bookings` = Bezahlte Buchungen nach Checkout

---

## 📊 Backend-Anzeige im Admin-Dashboard

### EventsList.tsx (Anfragen)
- Zeigt `event_inquiries` an
- Header: "Event-Anfragen"
- Beschreibung: "Verwalten Sie Catering-Anfragen und erstellen Sie Angebote."
- ⚠️ Terminologie-Inkonsistenz: "Catering-Anfragen" sollte "Event-Anfragen" sein

### EventBookingsList.tsx (Bezahlte Events)
- Zeigt `event_bookings` an
- Header: "Events"
- Beschreibung: "Bezahlte Events mit Menü-Konfiguration"
- ✅ Terminologie korrekt

### OrdersList.tsx (Catering)
- Zeigt `catering_orders` an
- Header: "Catering"
- Beschreibung: "Übersicht aller eingegangenen Bestellungen."
- ✅ Terminologie korrekt

---

## 🔧 Notwendige Korrekturen

### 1. Stripe-Handler für event_bookings erweitern (Kritisch)
```typescript
// handlePaymentSuccess muss BEIDE Tabellen prüfen
// 1. Erst catering_orders
// 2. Falls nicht gefunden: event_bookings
```

### 2. isEventBooking im Stripe-Cache
```typescript
const orderDataForCache = {
  // ... bestehende Felder
  isEventBooking: isEventBooking,  // NEU
  guestCount: eventGuestCount,     // NEU
  eventPackageName: eventItem?.name, // NEU
};
```

### 3. payment_status UPDATE nach Stripe-Zahlung
```typescript
// Nach erfolgreicher Stripe-Zahlung:
await supabase
  .from(isEventBooking ? 'event_bookings' : 'catering_orders')
  .update({ payment_status: 'paid' })
  .eq('order_number', orderNum);
```

### 4. Admin-Terminologie in EventsList.tsx
```diff
- <p className="text-muted-foreground">
-   Verwalten Sie Catering-Anfragen und erstellen Sie Angebote.
+ <p className="text-muted-foreground">
+   Verwalten Sie Event-Anfragen und erstellen Sie Angebote.
```

---

## Zusammenfassung der Befunde

| Bereich | Status | Problem |
|---------|--------|---------|
| E-Mail-Terminologie | ✅ Korrekt | - |
| Datenbank-Split | ✅ Korrekt | - |
| Invoice-E-Mail | ✅ Korrekt | - |
| Stripe für Events | ❌ Bug | Sucht nur in catering_orders |
| Stripe-Cache | ❌ Bug | isEventBooking fehlt |
| payment_status UPDATE | ❌ Bug | Wird nicht aktualisiert |
| Admin EventsList | ⚠️ Minor | Sagt "Catering-Anfragen" statt "Event-Anfragen" |
| Admin OrdersList | ✅ Korrekt | - |
| Admin BookingsList | ✅ Korrekt | - |
