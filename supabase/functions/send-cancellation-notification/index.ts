import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface CancellationNotificationRequest {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string;
  cancellationReason?: string;
  cancelledAt: string;
  totalAmount: number;
  items: OrderItem[];
  paymentMethod?: string;
  stripeRefunded: boolean;
  lexofficeCreditNote: boolean;
  desiredDate?: string;
  desiredTime?: string;
  isPickup?: boolean;
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

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('de-DE', {
    dateStyle: 'long',
    timeStyle: 'short'
  });
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const generateCustomerEmailText = (data: CancellationNotificationRequest): string => {
  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    itemsList += `• ${item.quantity}x ${item.name} – ${formatPrice(itemTotal)}\n`;
  }

  let refundInfo = '';
  if (data.stripeRefunded) {
    refundInfo = `
✓ Rückerstattung
Der Betrag von ${formatPrice(data.totalAmount)} wird auf Ihr Zahlungsmittel zurückerstattet. Die Gutschrift erfolgt in 5-10 Werktagen.
`;
  }

  const reasonText = data.cancellationReason 
    ? `Grund: ${data.cancellationReason}` 
    : '';

  return `STORIA · CATERING & EVENTS

Guten Tag ${data.customerName},

Ihre Bestellung wurde storniert.

Bestellnummer: ${data.orderNumber}
Storniert am: ${formatDateTime(data.cancelledAt)}
${reasonText}


STORNIERTE BESTELLUNG

${itemsList}
Ursprünglicher Gesamtbetrag: ${formatPrice(data.totalAmount)}
${refundInfo}
Falls Sie Fragen haben oder eine neue Bestellung aufgeben möchten, kontaktieren Sie uns gerne.


Bei Fragen erreichen Sie uns unter:
Tel: +49 89 51519696
E-Mail: info@events-storia.de

STORIA · Ristorante
Karlstraße 47a
80333 München

events-storia.de
`;
};

const generateRestaurantEmailText = (data: CancellationNotificationRequest): string => {
  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    itemsList += `• ${item.quantity}x ${item.name} – ${formatPrice(itemTotal)}\n`;
  }

  const reasonText = data.cancellationReason 
    ? data.cancellationReason 
    : 'Kein Grund angegeben';

  const deliveryInfo = data.isPickup 
    ? 'Abholung' 
    : 'Lieferung';

  const eventDate = data.desiredDate 
    ? `${formatDate(data.desiredDate)}${data.desiredTime ? ` um ${data.desiredTime} Uhr` : ''}`
    : 'Nicht angegeben';

  let actionsSummary = '';
  if (data.stripeRefunded) {
    actionsSummary += '✓ Stripe-Rückerstattung: Erstellt\n';
  } else if (data.paymentMethod === 'stripe') {
    actionsSummary += '⚠ Stripe-Rückerstattung: MANUELL PRÜFEN\n';
  }
  
  if (data.lexofficeCreditNote) {
    actionsSummary += '✓ LexOffice-Gutschrift: Erstellt\n';
  }

  if (!actionsSummary) {
    actionsSummary = 'Keine automatischen Aktionen erforderlich.\n';
  }

  return `⚠️ BESTELLUNG STORNIERT

Bestellnummer: ${data.orderNumber}
Storniert am: ${formatDateTime(data.cancelledAt)}
Grund: ${reasonText}


KUNDENDATEN

Name: ${data.customerName}
${data.companyName ? `Firma: ${data.companyName}\n` : ''}E-Mail: ${data.customerEmail}
Telefon: ${data.customerPhone}


URSPRÜNGLICHE BESTELLUNG

Art: ${deliveryInfo}
Termin: ${eventDate}

${itemsList}
Ursprünglicher Bestellwert: ${formatPrice(data.totalAmount)}


AUTOMATISCHE AKTIONEN

${actionsSummary}

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

  console.log(`Sending cancellation email via IONOS SMTP to: ${to.join(', ')}, subject: ${subject}`);

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

    console.log("Cancellation email sent successfully via IONOS SMTP");
  } finally {
    try {
      await client.close();
    } catch (closeError) {
      console.log("Client close warning:", closeError);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CancellationNotificationRequest = await req.json();
    console.log("Received cancellation notification request:", JSON.stringify(data, null, 2));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error: orderError } = await supabase
      .from('catering_orders')
      .select('id, order_number, cancelled_at, customer_email')
      .eq('order_number', data.orderNumber)
      .maybeSingle();

    if (orderError || !order) {
      console.log("Security: Order not found in database", { orderNumber: data.orderNumber });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders } }
      );
    }

    if (!order.cancelled_at) {
      console.log("Security: Order is not cancelled", { orderNumber: data.orderNumber });
      return new Response(
        JSON.stringify({ error: 'Order is not cancelled' }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders } }
      );
    }

    if (order.customer_email?.toLowerCase() !== data.customerEmail?.toLowerCase()) {
      console.log("Security: Email mismatch", { storedEmail: order.customer_email, requestEmail: data.customerEmail });
      return new Response(
        JSON.stringify({ error: 'Email mismatch' }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders } }
      );
    }

    console.log("Security: Order cancellation validated", { orderNumber: data.orderNumber });

    // Send customer email
    const customerSubject = `Stornierung Ihrer Bestellung ${data.orderNumber}`;
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
      entity_type: 'catering_order',
      entity_id: order.id,
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
        email_type: 'cancellation_customer',
        cancellation_reason: data.cancellationReason,
        stripe_refunded: data.stripeRefunded,
      },
    });

    // Send restaurant email
    const restaurantSubject = `STORNIERT: ${data.orderNumber}`;
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
      entity_type: 'catering_order',
      entity_id: order.id,
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
        email_type: 'cancellation_restaurant',
        cancellation_reason: data.cancellationReason,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Cancellation emails sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-cancellation-notification function:", error);
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
