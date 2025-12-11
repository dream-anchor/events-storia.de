import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

// ============================================
// CUSTOMER EMAIL TEMPLATE
// Anpassbar: Text hier ändern für Kunden-E-Mail
// ============================================
const generateCustomerEmailText = (data: CancellationNotificationRequest): string => {
  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    itemsList += `  ${item.quantity}x ${item.name}\n     ${formatPrice(itemTotal)}\n\n`;
  }

  let refundInfo = '';
  if (data.stripeRefunded) {
    refundInfo = `
✓ RÜCKERSTATTUNG
Der Betrag von ${formatPrice(data.totalAmount)} wird auf Ihr Zahlungsmittel 
zurückerstattet. Die Gutschrift erfolgt in 5-10 Werktagen.
`;
  }

  const reasonText = data.cancellationReason 
    ? `Grund: ${data.cancellationReason}` 
    : '';

  return `════════════════════════════════════════════
          STORIA · CATERING & EVENTS
════════════════════════════════════════════

Guten Tag ${data.customerName},

Ihre Bestellung wurde storniert.

Bestellnummer: ${data.orderNumber}
Storniert am: ${formatDateTime(data.cancelledAt)}
${reasonText}

────────────────────────────────────────────
STORNIERTE BESTELLUNG
────────────────────────────────────────────

${itemsList}────────────────────────────────────────────
Ursprünglicher Gesamtbetrag: ${formatPrice(data.totalAmount)}
────────────────────────────────────────────
${refundInfo}
Falls Sie Fragen haben oder eine neue Bestellung 
aufgeben möchten, kontaktieren Sie uns gerne.

────────────────────────────────────────────
Bei Fragen erreichen Sie uns unter:

Tel: +49 89 51519696
E-Mail: info@events-storia.de

STORIA · Ristorante
Karlstraße 47a
80333 München

events-storia.de
════════════════════════════════════════════
`;
};

// ============================================
// RESTAURANT EMAIL TEMPLATE
// Anpassbar: Text hier ändern für Restaurant-E-Mail
// ============================================
const generateRestaurantEmailText = (data: CancellationNotificationRequest): string => {
  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    itemsList += `  ${item.quantity}x ${item.name}\n     ${formatPrice(itemTotal)}\n\n`;
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

  return `════════════════════════════════════════════
     ⚠️ BESTELLUNG STORNIERT
════════════════════════════════════════════

Bestellnummer: ${data.orderNumber}
Storniert am: ${formatDateTime(data.cancelledAt)}
Grund: ${reasonText}

────────────────────────────────────────────
KUNDENDATEN
────────────────────────────────────────────

Name: ${data.customerName}
${data.companyName ? `Firma: ${data.companyName}\n` : ''}E-Mail: ${data.customerEmail}
Telefon: ${data.customerPhone}

────────────────────────────────────────────
URSPRÜNGLICHE BESTELLUNG
────────────────────────────────────────────

Art: ${deliveryInfo}
Termin: ${eventDate}

${itemsList}────────────────────────────────────────────
Ursprünglicher Bestellwert: ${formatPrice(data.totalAmount)}
────────────────────────────────────────────

AUTOMATISCHE AKTIONEN
${actionsSummary}
────────────────────────────────────────────
Admin-Bereich: https://storia-catering.lovable.app/admin
════════════════════════════════════════════
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
      html: `<html><body><pre style="font-family: monospace; white-space: pre-wrap;">${text}</pre></body></html>`,
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

    // Customer email
    const customerSubject = `Stornierung Ihrer Bestellung ${data.orderNumber}`;
    const customerEmailText = generateCustomerEmailText(data);
    
    await sendEmail(
      [data.customerEmail],
      customerSubject,
      customerEmailText,
      "STORIA Catering"
    );

    // Restaurant email
    const restaurantSubject = `STORNIERT: ${data.orderNumber}`;
    const restaurantEmailText = generateRestaurantEmailText(data);
    
    await sendEmail(
      ["info@events-storia.de"],
      restaurantSubject,
      restaurantEmailText,
      "STORIA Bestellsystem"
    );

    return new Response(
      JSON.stringify({ success: true, message: "Cancellation emails sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-cancellation-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
