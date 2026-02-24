import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface OrderItem {
  id: string;
  name: string;
  name_en?: string;
  quantity: number;
  price: number;
  servingInfo?: string;
}

interface BillingAddress {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

interface OrderNotificationRequest {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string;
  deliveryAddress?: string;
  deliveryStreet?: string;
  deliveryZip?: string;
  deliveryCity?: string;
  deliveryFloor?: string;
  hasElevator?: boolean;
  isPickup: boolean;
  isEventBooking?: boolean;
  eventPackageName?: string;
  guestCount?: number;
  desiredDate?: string;
  desiredTime?: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCost?: number;
  minimumOrderSurcharge?: number;
  distanceKm?: number;
  grandTotal: number;
  billingAddress?: BillingAddress;
  totalAmount?: number;
  paymentMethod?: 'invoice' | 'stripe';
  paymentStatus?: 'pending' | 'paid' | 'failed';
  wantsChafingDish?: boolean;
  chafingDishQuantity?: number;
  chafingDishTotal?: number;
}

interface EmailLogEntry {
  entity_type: string;
  entity_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  provider: string;
  provider_message_id: string | null;
  status: string;
  error_message: string | null;
  sent_by: string | null;
  metadata: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function logEmailDelivery(supabase: any, entry: EmailLogEntry) {
  try {
    const { error } = await supabase
      .from('email_delivery_logs')
      .insert(entry);
    
    if (error) {
      console.error('Failed to log email delivery:', error);
    } else {
      console.log('Email delivery logged:', entry.status, entry.recipient_email);
    }
  } catch (err) {
    console.error('Error logging email delivery:', err);
  }
}

const formatPrice = (price: number) => price.toFixed(2).replace('.', ',') + ' €';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const generateCustomerEmailText = (data: OrderNotificationRequest): string => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  const isPaid = data.paymentStatus === 'paid';
  const isEvent = data.isEventBooking === true;

  let greeting: string;
  let nextSteps: string;
  
  if (isEvent) {
    greeting = isPaid
      ? 'vielen Dank für Ihre Event-Buchung!'
      : 'vielen Dank für Ihre Event-Anfrage!';
    nextSteps = isPaid
      ? 'Ihre Zahlung wurde erfolgreich verarbeitet. Wir werden uns in Kürze mit Ihnen bezüglich der Menüauswahl in Verbindung setzen.'
      : 'Wir melden uns innerhalb von 24 Stunden bei Ihnen, um die Details Ihrer Veranstaltung zu besprechen.';
  } else {
    greeting = isPaid
      ? 'vielen Dank für Ihre Bestellung!'
      : 'vielen Dank für Ihre Anfrage!';
    nextSteps = isPaid
      ? 'Ihre Zahlung wurde erfolgreich verarbeitet. Wir bereiten Ihre Bestellung vor.'
      : 'Wir melden uns innerhalb von 24 Stunden bei Ihnen.';
  }

  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    const servingInfo = item.servingInfo ? ` (${item.servingInfo})` : '';
    itemsList += `• ${item.quantity}x ${item.name}${servingInfo} – ${formatPrice(itemTotal)}\n`;
  }

  if (data.wantsChafingDish && data.chafingDishQuantity && data.chafingDishTotal) {
    itemsList += `• ${data.chafingDishQuantity}x Chafing Dish (Warmhaltebehälter) – ${formatPrice(data.chafingDishTotal)}\n`;
  }

  let deliveryInfo = '';
  if (isEvent) {
    deliveryInfo = `Veranstaltungsort: STORIA Ristorante, Karlstraße 47a, 80333 München`;
    if (data.guestCount) {
      deliveryInfo += `\nAnzahl Gäste: ${data.guestCount} Personen`;
    }
  } else if (data.isPickup) {
    deliveryInfo = `Lieferart: Selbstabholung\nAbholadresse: Karlstraße 47a, 80333 München`;
  } else {
    const floorInfo = data.deliveryFloor ? `, Stockwerk: ${data.deliveryFloor}` : '';
    const elevatorInfo = data.hasElevator === true ? ', Aufzug vorhanden' : (data.hasElevator === false ? ', kein Aufzug' : '');

    if (data.deliveryStreet && data.deliveryZip && data.deliveryCity) {
      deliveryInfo = `Lieferart: Lieferung\nAdresse: ${data.deliveryStreet}, ${data.deliveryZip} ${data.deliveryCity}${floorInfo}${elevatorInfo}`;
    } else if (data.deliveryAddress) {
      deliveryInfo = `Lieferart: Lieferung\nAdresse: ${data.deliveryAddress}${floorInfo}${elevatorInfo}`;
    }
  }

  let priceBreakdown = `Zwischensumme: ${formatPrice(subtotal)}\n`;

  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdown += `Mindestbestellwert-Aufschlag: ${formatPrice(data.minimumOrderSurcharge)}\n`;
  }

  if (!isEvent) {
    if (data.isPickup) {
      priceBreakdown += `Selbstabholung: kostenlos\n`;
    } else if (data.deliveryCost !== undefined) {
      const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
      priceBreakdown += `Lieferung${distanceText}: ${data.deliveryCost === 0 ? 'kostenlos' : formatPrice(data.deliveryCost)}\n`;
    }
  }

  const notesSection = data.notes ? `\nIhre Anmerkungen:\n${data.notes}\n` : '';

  const headerTitle = isEvent ? 'STORIA · EVENTS' : 'STORIA · CATERING & EVENTS';
  const orderLabel = isEvent ? 'Buchungsnummer' : 'Bestellnummer';

  return `${headerTitle}

Guten Tag ${data.customerName},

${greeting}

${orderLabel}: ${data.orderNumber}


${isEvent ? 'IHRE BUCHUNG' : 'IHRE AUSWAHL'}

${itemsList}
${priceBreakdown}
Gesamtsumme: ${formatPrice(grandTotal)}


${isEvent ? 'VERANSTALTUNG' : 'TERMIN & LIEFERUNG'}

${deliveryInfo}
Datum: ${data.desiredDate ? formatDate(data.desiredDate) : 'Auf Anfrage'}
Uhrzeit: ${data.desiredTime ? data.desiredTime + ' Uhr' : 'Auf Anfrage'}
${notesSection}
${nextSteps}


Bei Fragen erreichen Sie uns unter:
Tel: +49 89 51519696
E-Mail: info@events-storia.de

STORIA · Ristorante
Karlstraße 47a
80333 München

events-storia.de
`;
};

const generateRestaurantEmailText = (data: OrderNotificationRequest): string => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  const isPaid = data.paymentStatus === 'paid';
  const isEvent = data.isEventBooking === true;

  const now = new Date().toLocaleString('de-DE', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const paymentBanner = isPaid
    ? '✓ BEREITS BEZAHLT'
    : '⏳ Zahlung ausstehend (Anfrage)';

  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    const servingInfo = item.servingInfo ? ` (${item.servingInfo})` : '';
    itemsList += `• ${item.quantity}x ${item.name}${servingInfo}\n  Einzelpreis: ${formatPrice(item.price)} | Gesamt: ${formatPrice(itemTotal)}\n\n`;
  }

  if (data.wantsChafingDish && data.chafingDishQuantity && data.chafingDishTotal) {
    itemsList += `• ${data.chafingDishQuantity}x Chafing Dish (Warmhaltebehälter) – ${formatPrice(data.chafingDishTotal)}\n\n`;
  }

  let deliveryInfo = '';
  if (isEvent) {
    deliveryInfo = `Typ: EVENT-BUCHUNG (vor Ort im Restaurant)`;
    if (data.guestCount) {
      deliveryInfo += `\nAnzahl Gäste: ${data.guestCount} Personen`;
    }
    deliveryInfo += `\n\n⚠️ MENÜAUSWAHL ERFORDERLICH – Bitte Kunden kontaktieren!`;
  } else if (data.isPickup) {
    deliveryInfo = 'Lieferart: SELBSTABHOLUNG';
  } else {
    const floorInfo = data.deliveryFloor ? `, Stockwerk: ${data.deliveryFloor}` : '';
    const elevatorInfo = data.hasElevator === true ? ', Aufzug vorhanden' : (data.hasElevator === false ? ', kein Aufzug' : '');

    if (data.deliveryStreet && data.deliveryZip && data.deliveryCity) {
      deliveryInfo = `Lieferart: LIEFERUNG\nAdresse: ${data.deliveryStreet}, ${data.deliveryZip} ${data.deliveryCity}${floorInfo}${elevatorInfo}`;
    } else if (data.deliveryAddress) {
      deliveryInfo = `Lieferart: LIEFERUNG\nAdresse: ${data.deliveryAddress}${floorInfo}${elevatorInfo}`;
    }
  }

  let priceBreakdown = `Warenwert: ${formatPrice(subtotal)}\n`;

  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdown += `Mindestbestellwert-Aufschlag: ${formatPrice(data.minimumOrderSurcharge)}\n`;
  }

  if (!isEvent) {
    if (data.isPickup) {
      priceBreakdown += `Selbstabholung: kostenlos\n`;
    } else if (data.deliveryCost !== undefined) {
      const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
      priceBreakdown += `Lieferkosten${distanceText}: ${data.deliveryCost === 0 ? 'kostenlos' : formatPrice(data.deliveryCost)}\n`;
    }
  }

  const notesSection = data.notes ? `\nAnmerkungen des Kunden:\n${data.notes}\n` : '';

  let billingSection = '';
  if (data.billingAddress && data.billingAddress.name) {
    billingSection = `\nRechnungsadresse:\n${data.billingAddress.name}\n${data.billingAddress.street}\n${data.billingAddress.zip} ${data.billingAddress.city}\n${data.billingAddress.country}\n`;
  }

  const headerTitle = isEvent 
    ? 'NEUE EVENT-BUCHUNG EINGEGANGEN' 
    : 'NEUE CATERING-BESTELLUNG EINGEGANGEN';
  const orderLabel = isEvent ? 'Buchungsnummer' : 'Bestellnummer';
  const itemsLabel = isEvent ? 'GEBUCHTES PAKET' : 'BESTELLTE ARTIKEL';

  return `${headerTitle}

${paymentBanner}

${orderLabel}: ${data.orderNumber}
Eingegangen: ${now}


KUNDENDATEN

Name: ${data.customerName}
${data.companyName ? `Firma: ${data.companyName}\n` : ''}E-Mail: ${data.customerEmail}
Telefon: ${data.customerPhone}


${itemsLabel}

${itemsList}
${priceBreakdown}
Gesamtsumme: ${formatPrice(grandTotal)}


${isEvent ? 'VERANSTALTUNG' : 'TERMIN & LIEFERUNG'}

${deliveryInfo}
Datum: ${data.desiredDate ? formatDate(data.desiredDate) : 'Auf Anfrage'}
Uhrzeit: ${data.desiredTime ? data.desiredTime + ' Uhr' : 'Auf Anfrage'}
${notesSection}${billingSection}

Admin-Bereich: https://events-storia.de/admin
`;
};

async function sendEmail(to: string[], subject: string, text: string, fromName: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  console.log(`SMTP_HOST: ${smtpHost}, SMTP_PORT: ${smtpPort}`);

  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP credentials not configured (SMTP_USER, SMTP_PASSWORD)");
  }

  console.log(`Sending email via IONOS SMTP (SSL) to: ${to.join(', ')}, subject: ${subject}`);

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: true,
      auth: {
        username: smtpUser,
        password: smtpPassword,
      },
    },
  });

  try {
    await client.send({
      from: `${fromName} <${smtpUser}>`,
      to: to,
      subject: subject,
      html: `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${text}</div>
</body>
</html>`,
    });

    console.log("Email sent successfully via IONOS SMTP");
  } finally {
    try {
      await client.close();
    } catch (closeError) {
      console.log("Client close warning:", closeError);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: OrderNotificationRequest = await req.json();
    console.log("Received order notification request:", JSON.stringify(data, null, 2));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let orderExists = false;
    let storedEmail: string | null = null;
    let entityId: string | null = null;
    const isEvent = data.isEventBooking === true;

    if (isEvent) {
      const { data: eventBooking } = await supabase
        .from('event_bookings')
        .select('id, customer_email')
        .eq('booking_number', data.orderNumber)
        .maybeSingle();
      
      if (eventBooking) {
        orderExists = true;
        storedEmail = eventBooking.customer_email;
        entityId = eventBooking.id;
      }
    } else {
      const { data: cateringOrder } = await supabase
        .from('catering_orders')
        .select('id, customer_email')
        .eq('order_number', data.orderNumber)
        .maybeSingle();

      if (cateringOrder) {
        orderExists = true;
        storedEmail = cateringOrder.customer_email;
        entityId = cateringOrder.id;
      }
    }

    if (!orderExists || !entityId) {
      console.log("Security: Order not found in database", { orderNumber: data.orderNumber });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders } }
      );
    }

    if (storedEmail?.toLowerCase() !== data.customerEmail?.toLowerCase()) {
      console.log("Security: Email mismatch", { storedEmail, requestEmail: data.customerEmail });
      return new Response(
        JSON.stringify({ error: 'Email mismatch' }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders } }
      );
    }

    console.log("Security: Order validated", { orderNumber: data.orderNumber });

    const isPaid = data.paymentStatus === 'paid';

    const customerSubject = isEvent
      ? (isPaid
        ? `Ihre Event-Buchung bei STORIA (${data.orderNumber})`
        : `Ihre Event-Anfrage bei STORIA (${data.orderNumber})`)
      : (isPaid
        ? `Ihre Catering-Bestellung bei STORIA (${data.orderNumber})`
        : `Ihre Catering-Anfrage bei STORIA (${data.orderNumber})`);

    const restaurantSubject = isEvent
      ? (isPaid
        ? `BEZAHLT: Neue Event-Buchung ${data.orderNumber}`
        : `Neue Event-Anfrage ${data.orderNumber}`)
      : (isPaid
        ? `BEZAHLT: Neue Bestellung ${data.orderNumber}`
        : `Neue Anfrage ${data.orderNumber}`);

    // Send customer email
    const customerEmailText = generateCustomerEmailText(data);
    let customerEmailSent = false;
    let customerEmailError: string | null = null;
    
    try {
      await sendEmail(
        [data.customerEmail],
        customerSubject,
        customerEmailText,
        "STORIA Catering"
      );
      customerEmailSent = true;
    } catch (err) {
      customerEmailError = err instanceof Error ? err.message : 'Unknown error';
      console.error('Customer email error:', customerEmailError);
    }

    // Log customer email
    await logEmailDelivery(supabase, {
      entity_type: isEvent ? 'event_booking' : 'catering_order',
      entity_id: entityId,
      recipient_email: data.customerEmail,
      recipient_name: data.customerName,
      subject: customerSubject,
      provider: 'ionos_smtp',
      provider_message_id: null,
      status: customerEmailSent ? 'sent' : 'failed',
      error_message: customerEmailError,
      sent_by: 'system',
      metadata: {
        order_number: data.orderNumber,
        email_type: 'order_confirmation_customer',
        payment_status: data.paymentStatus,
      },
    });

    // Send restaurant email
    const restaurantEmailText = generateRestaurantEmailText(data);
    let restaurantEmailSent = false;
    let restaurantEmailError: string | null = null;
    
    try {
      await sendEmail(
        ["info@events-storia.de"],
        restaurantSubject,
        restaurantEmailText,
        "STORIA Bestellsystem"
      );
      restaurantEmailSent = true;
    } catch (err) {
      restaurantEmailError = err instanceof Error ? err.message : 'Unknown error';
      console.error('Restaurant email error:', restaurantEmailError);
    }

    // Log restaurant email
    await logEmailDelivery(supabase, {
      entity_type: isEvent ? 'event_booking' : 'catering_order',
      entity_id: entityId,
      recipient_email: 'info@events-storia.de',
      recipient_name: 'STORIA Team',
      subject: restaurantSubject,
      provider: 'ionos_smtp',
      provider_message_id: null,
      status: restaurantEmailSent ? 'sent' : 'failed',
      error_message: restaurantEmailError,
      sent_by: 'system',
      metadata: {
        order_number: data.orderNumber,
        email_type: 'order_notification_restaurant',
        payment_status: data.paymentStatus,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Emails sent successfully via IONOS SMTP" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-order-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  }
};

serve(handler);
