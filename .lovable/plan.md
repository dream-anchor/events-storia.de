

## Problem-Analyse

Es gibt **zwei getrennte Flows** für Benachrichtigungen:

### 1. Event-Anfragen (über Website-Formulare)
- `EventContactForm.tsx` und `EventPackageInquiryDialog.tsx` rufen die Edge Function `receive-event-inquiry` auf
- Diese Function speichert die Anfrage in `event_inquiries` UND sendet Emails (Kunden-Bestätigung + Restaurant-Benachrichtigung)
- **Dieser Flow funktioniert korrekt** — die Giulia-Anfrage vom 3. Februar zeigt `notification_sent = true`

### 2. Catering-Bestellungen (Checkout)
- `Checkout.tsx` speichert die Bestellung direkt per `supabase.from('catering_orders').insert(...)` (Zeile 1057)
- `send-order-notification` wird **NUR** im Stripe-Success-Callback aufgerufen (Zeile 635)
- **Bei Rechnungszahlung (invoice) wird KEINE Email verschickt** — weder an den Kunden noch ans Restaurant

### 3. Manuell erfasste Anfragen (Admin → OfferCreate)
- `OfferCreate/index.tsx` speichert direkt in `event_inquiries` per `.insert()`
- **Keine Email-Benachrichtigung** — weder an Kunden noch ans Restaurant

---

## Lösung: Notification-Aufruf in ALLEN Pfaden sicherstellen

### Schritt 1: Catering-Checkout — `send-order-notification` nach jedem Insert aufrufen

In `src/pages/Checkout.tsx` nach dem erfolgreichen DB-Insert (ca. Zeile 1093), BEVOR der Stripe/Invoice-Pfad ausgewählt wird, den Notification-Call einfügen:

```typescript
// Nach dem DB-Insert, VOR dem Payment-Redirect oder navigate
const notificationPayload = {
  orderNumber: newOrderNumber,
  customerName: formData.name,
  customerEmail: formData.email,
  customerPhone: formData.phone,
  companyName: formData.company || undefined,
  items: orderItems,
  subtotal: totalPrice,
  deliveryCost: deliveryCalc?.deliveryCostGross || 0,
  minimumOrderSurcharge,
  distanceKm: deliveryCalc?.distanceKm || undefined,
  grandTotal,
  isPickup: formData.deliveryType === 'pickup',
  desiredDate: formData.date || undefined,
  desiredTime: formData.time || undefined,
  deliveryStreet: formData.deliveryStreet || undefined,
  deliveryZip: formData.deliveryZip || undefined,
  deliveryCity: formData.deliveryCity || undefined,
  deliveryFloor: formData.deliveryFloor || undefined,
  hasElevator: formData.hasElevator,
  notes: fullNotes || undefined,
  billingAddress,
  paymentMethod,
  paymentStatus: 'pending',
  isEventBooking,
  guestCount: eventGuestCount || undefined,
  eventPackageName: eventItem?.name || undefined,
};

// Fire-and-forget — Bestellung ist gespeichert, Email darf nicht blockieren
supabase.functions.invoke('send-order-notification', { body: notificationPayload })
  .catch(err => console.error('Notification error:', err));
```

Beim Stripe-Success-Callback (Zeile 635) den doppelten Aufruf entfernen oder nur den `paymentStatus: 'paid'` Update senden, damit keine doppelte Email kommt. Hierzu prüfen wir, ob die initiale Notification bereits gesendet wurde (z.B. via `email_delivery_logs`).

**Einfacherer Ansatz**: Notification nur EINMAL beim Insert senden (mit `paymentStatus: 'pending'`). Im Stripe-Callback KEINE zweite Notification senden — oder nur ein Status-Update-Email ("Zahlung bestätigt").

### Schritt 2: Stripe-Callback — Doppelte Emails vermeiden

Im Stripe-Success-Callback (Zeile 630-637) den `send-order-notification` Aufruf entfernen, da die Notification bereits beim Insert gesendet wurde.

### Schritt 3: Event-Anfragen über Admin (OfferCreate)

In `src/components/admin/refine/OfferCreate/index.tsx` nach dem `saveInquiry()` Call ebenfalls `receive-event-inquiry`-ähnliche Notification triggern, oder einen separaten Aufruf an `send-order-notification` / `receive-event-inquiry` machen.

Da Admin-Erfassungen manuell sind und der Admin die Anfrage bereits kennt, ist hier die **Restaurant-Notification optional** — aber die **Kunden-Bestätigung** sollte gesendet werden können (als Option).

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|---|---|
| `src/pages/Checkout.tsx` | `send-order-notification` direkt nach DB-Insert aufrufen (für ALLE Zahlungsarten) |
| `src/pages/Checkout.tsx` | Doppelten Notification-Call im Stripe-Callback entfernen |
| `src/components/admin/refine/OfferCreate/index.tsx` | Optional: Kunden-Bestätigungsmail nach manueller Erfassung |

Keine Änderungen an Edge Functions nötig — `send-order-notification` und `receive-event-inquiry` funktionieren korrekt. Das Problem liegt ausschließlich darin, dass `send-order-notification` im Checkout nicht in allen Pfaden aufgerufen wird.

