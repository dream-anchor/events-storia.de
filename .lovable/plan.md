
# Sicherheits-Fixes: Edge Functions und RLS Policies

## Analyse der gefundenen Probleme

### 🔴 Kritisch: Edge Functions ohne Authentifizierung
Diese Edge Functions sind öffentlich zugänglich, obwohl sie kritische Geschäftslogik ausführen:

| Function | Problem | Lösung |
|----------|---------|--------|
| `create-lexoffice-invoice` | Erstellt Rechnungen/Angebote ohne Auth | In-Code Validierung: Order muss existieren, Email muss übereinstimmen |
| `send-order-notification` | Sendet E-Mails ohne Auth | In-Code Validierung: Order muss in DB existieren |
| `send-cancellation-notification` | Sendet Stornierung-Emails | Wird nur intern aufgerufen - API-Key/Signatur prüfen |
| `handle-offer-payment` | Verarbeitet Zahlungen | Stripe Webhook Signatur bereits implementiert ✅ |

**Hinweis**: Diese Functions können nicht auf `verify_jwt = true` gesetzt werden, da sie:
- Von nicht eingeloggten Kunden aufgerufen werden (Checkout)
- Als Stripe Webhooks fungieren
- Die bessere Lösung ist In-Code Validierung

### 🟡 Mittel: RLS Policies mit `WITH CHECK (true)`

| Tabelle | Policy | Problem |
|---------|--------|---------|
| `catering_orders` | Anyone can insert | Erlaubt anonyme Inserts - **GEWOLLT** für Guest Checkout |
| `event_inquiries` | Anyone can insert | Erlaubt anonyme Inserts - **GEWOLLT** für Kontaktformular |

Diese sind **beabsichtigt** und notwendig für:
- Gast-Bestellungen ohne Login
- Event-Anfragen über das Kontaktformular

### ✅ Bereits implementierte Sicherheitsmaßnahmen
- `create-catering-payment` validiert bereits Order-Existenz und Email-Match
- `cancel-catering-order` erfordert Admin-Auth
- `get-lexoffice-document` erfordert Admin-Auth
- RLS auf sensiblen Tabellen korrekt konfiguriert

---

## Implementierungsplan

### 1. `create-lexoffice-invoice` absichern
**Datei**: `supabase/functions/create-lexoffice-invoice/index.ts`

```typescript
// Nach CORS-Handler (Zeile ~120):
// SECURITY: Verify order exists and matches request data
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const { data: order, error: orderError } = await supabase
  .from('catering_orders')
  .select('id, order_number, customer_email, total_amount')
  .eq('id', body.orderId)
  .single();

if (orderError || !order) {
  return new Response(
    JSON.stringify({ error: 'Order not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Verify email matches
if (order.customer_email !== body.customerEmail) {
  return new Response(
    JSON.stringify({ error: 'Email mismatch' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 2. `send-order-notification` absichern
**Datei**: `supabase/functions/send-order-notification/index.ts`

```typescript
// Nach Request-Body-Parsing:
// SECURITY: Verify order exists in database
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Check catering_orders first
let orderExists = false;
const { data: cateringOrder } = await supabase
  .from('catering_orders')
  .select('id, customer_email')
  .eq('order_number', data.orderNumber)
  .single();

if (cateringOrder) {
  orderExists = true;
  // Verify email matches
  if (cateringOrder.customer_email !== data.customerEmail) {
    return new Response(
      JSON.stringify({ error: 'Email mismatch' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
} else if (data.isEventBooking) {
  // Check event_bookings for event orders
  const { data: eventBooking } = await supabase
    .from('event_bookings')
    .select('id, customer_email')
    .eq('booking_number', data.orderNumber)
    .single();
  
  if (eventBooking) {
    orderExists = true;
    if (eventBooking.customer_email !== data.customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Email mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
}

if (!orderExists) {
  return new Response(
    JSON.stringify({ error: 'Order not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 3. `send-cancellation-notification` absichern
**Datei**: `supabase/functions/send-cancellation-notification/index.ts`

Diese Function wird nur intern von `cancel-catering-order` aufgerufen. Wir fügen eine Validierung hinzu:

```typescript
// Nach Request-Body-Parsing:
// SECURITY: Verify the order was actually cancelled in database
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const { data: order, error: orderError } = await supabase
  .from('catering_orders')
  .select('id, order_number, cancelled_at, customer_email')
  .eq('order_number', data.orderNumber)
  .single();

if (orderError || !order) {
  return new Response(
    JSON.stringify({ error: 'Order not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Verify order is actually cancelled
if (!order.cancelled_at) {
  return new Response(
    JSON.stringify({ error: 'Order is not cancelled' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Verify email matches
if (order.customer_email !== data.customerEmail) {
  return new Response(
    JSON.stringify({ error: 'Email mismatch' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 4. Input-Validierung mit Zod (optional, empfohlen)
Alle Edge Functions sollten die Eingabedaten mit Zod validieren:

```typescript
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const requestSchema = z.object({
  orderNumber: z.string().min(1).max(50),
  customerEmail: z.string().email().max(255),
  customerName: z.string().min(1).max(100),
  // ... weitere Felder
});

// In der Handler-Funktion:
const parseResult = requestSchema.safeParse(body);
if (!parseResult.success) {
  return new Response(
    JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten() }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
const data = parseResult.data;
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `supabase/functions/create-lexoffice-invoice/index.ts` | Order-Existenz und Email-Validierung hinzufügen |
| `supabase/functions/send-order-notification/index.ts` | Order-Existenz und Email-Validierung hinzufügen |
| `supabase/functions/send-cancellation-notification/index.ts` | Order-Stornierung und Email-Validierung hinzufügen |

## Nicht geändert (bereits sicher oder beabsichtigt)
- `calculate-delivery` - Öffentlich, nur Adress-Geocoding, keine sensiblen Daten
- `receive-event-inquiry` - Öffentlich, wie gewünscht für Kontaktformular
- `fetch-ristorante-menus` - Öffentlich, nur Menü-Daten lesen
- `handle-offer-payment` - Stripe Webhook Signatur bereits validiert
- RLS INSERT Policies - Beabsichtigt für Guest Checkout

## Technische Details
- Alle Validierungen verwenden Service Role Key für DB-Zugriff
- Email-Vergleich verhindert dass Angreifer Emails an beliebige Adressen senden
- Order-Existenz-Check verhindert Spam und ungültige Requests
- Stornierung-Check verhindert gefälschte Stornierung-Emails
