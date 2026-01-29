import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  // Different greetings based on payment status (not payment method!)
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
    itemsList += `  ${item.quantity}x ${item.name}${servingInfo}\n     ${formatPrice(itemTotal)}\n\n`;
  }

  // Chafing Dish
  if (data.wantsChafingDish && data.chafingDishQuantity && data.chafingDishTotal) {
    itemsList += `  ${data.chafingDishQuantity}x Chafing Dish (Warmhaltebehälter)\n     ${formatPrice(data.chafingDishTotal)}\n\n`;
  }

  // Delivery info - different for events vs catering
  let deliveryInfo = '';
  if (isEvent) {
    deliveryInfo = `Veranstaltungsort: STORIA Ristorante
Karlstraße 47a, 80333 München`;
    if (data.guestCount) {
      deliveryInfo += `\nAnzahl Gäste: ${data.guestCount} Personen`;
    }
  } else if (data.isPickup) {
    deliveryInfo = `Lieferart: Selbstabholung
Abholadresse: Karlstraße 47a, 80333 München`;
  } else {
    const floorInfo = data.deliveryFloor ? `\nStockwerk: ${data.deliveryFloor}` : '';
    const elevatorInfo = data.hasElevator === true ? '\nAufzug: Ja' : (data.hasElevator === false ? '\nAufzug: Nein' : '');

    if (data.deliveryStreet && data.deliveryZip && data.deliveryCity) {
      deliveryInfo = `Lieferart: Lieferung
Adresse: ${data.deliveryStreet}
         ${data.deliveryZip} ${data.deliveryCity}${floorInfo}${elevatorInfo}`;
    } else if (data.deliveryAddress) {
      deliveryInfo = `Lieferart: Lieferung
Adresse: ${data.deliveryAddress}${floorInfo}${elevatorInfo}`;
    }
  }

  // Price breakdown
  let priceBreakdown = `Zwischensumme:              ${formatPrice(subtotal)}\n`;

  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdown += `Mindestbestellwert-Aufschlag: ${formatPrice(data.minimumOrderSurcharge)}\n`;
  }

  if (!isEvent) {
    if (data.isPickup) {
      priceBreakdown += `Selbstabholung:             kostenlos\n`;
    } else if (data.deliveryCost !== undefined) {
      const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
      priceBreakdown += `Lieferung${distanceText}:      ${data.deliveryCost === 0 ? 'kostenlos' : formatPrice(data.deliveryCost)}\n`;
    }
  }

  const notesSection = data.notes ? `\nIHRE ANMERKUNGEN\n${data.notes}\n` : '';

  const headerTitle = isEvent ? 'STORIA · EVENTS' : 'STORIA · CATERING & EVENTS';
  const orderLabel = isEvent ? 'Buchungsnummer' : 'Bestellnummer';

  return `════════════════════════════════════════════
          ${headerTitle}
════════════════════════════════════════════

Guten Tag ${data.customerName},

${greeting}

${orderLabel}: ${data.orderNumber}

────────────────────────────────────────────
${isEvent ? 'IHRE BUCHUNG' : 'IHRE AUSWAHL'}
────────────────────────────────────────────

${itemsList}────────────────────────────────────────────
${priceBreakdown}────────────────────────────────────────────
GESAMTSUMME:                ${formatPrice(grandTotal)}
────────────────────────────────────────────

${isEvent ? 'VERANSTALTUNG' : 'TERMIN & LIEFERUNG'}

${deliveryInfo}
Datum: ${data.desiredDate ? formatDate(data.desiredDate) : 'Auf Anfrage'}
Uhrzeit: ${data.desiredTime ? data.desiredTime + ' Uhr' : 'Auf Anfrage'}
${notesSection}
${nextSteps}

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

const generateRestaurantEmailText = (data: OrderNotificationRequest): string => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  const isPaid = data.paymentStatus === 'paid';
  const isEvent = data.isEventBooking === true;

  const now = new Date().toLocaleString('de-DE', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  let paymentBanner = '';
  if (isPaid) {
    paymentBanner = `
╔════════════════════════════════════════════╗
║  ✓ BEREITS BEZAHLT                         ║
╚════════════════════════════════════════════╝
`;
  } else {
    paymentBanner = `
╔════════════════════════════════════════════╗
║  Zahlung ausstehend (Anfrage)              ║
╚════════════════════════════════════════════╝
`;
  }

  let itemsList = '';
  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    const servingInfo = item.servingInfo ? ` (${item.servingInfo})` : '';
    itemsList += `  ${item.quantity}x ${item.name}${servingInfo}\n     Einzelpreis: ${formatPrice(item.price)} | Gesamt: ${formatPrice(itemTotal)}\n\n`;
  }

  // Chafing Dish
  if (data.wantsChafingDish && data.chafingDishQuantity && data.chafingDishTotal) {
    itemsList += `  ${data.chafingDishQuantity}x Chafing Dish (Warmhaltebehälter)\n     ${formatPrice(data.chafingDishTotal)}\n\n`;
  }

  // Delivery/Event info - different for events vs catering
  let deliveryInfo = '';
  if (isEvent) {
    deliveryInfo = `Typ: EVENT-BUCHUNG (vor Ort im Restaurant)`;
    if (data.guestCount) {
      deliveryInfo += `\nAnzahl Gäste: ${data.guestCount} Personen`;
    }
    deliveryInfo += `\n\n⚠️ MENÜAUSWAHL ERFORDERLICH - Bitte Kunden kontaktieren!`;
  } else if (data.isPickup) {
    deliveryInfo = 'Lieferart: SELBSTABHOLUNG';
  } else {
    const floorInfo = data.deliveryFloor ? `\nStockwerk: ${data.deliveryFloor}` : '';
    const elevatorInfo = data.hasElevator === true ? '\nAufzug: Ja' : (data.hasElevator === false ? '\nAufzug: Nein' : '');

    if (data.deliveryStreet && data.deliveryZip && data.deliveryCity) {
      deliveryInfo = `Lieferart: LIEFERUNG
Adresse: ${data.deliveryStreet}
         ${data.deliveryZip} ${data.deliveryCity}${floorInfo}${elevatorInfo}`;
    } else if (data.deliveryAddress) {
      deliveryInfo = `Lieferart: LIEFERUNG
Adresse: ${data.deliveryAddress}${floorInfo}${elevatorInfo}`;
    }
  }

  // Price breakdown
  let priceBreakdown = `Warenwert:                  ${formatPrice(subtotal)}\n`;

  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdown += `Mindestbestellwert-Aufschlag: ${formatPrice(data.minimumOrderSurcharge)}\n`;
  }

  if (!isEvent) {
    if (data.isPickup) {
      priceBreakdown += `Selbstabholung:             kostenlos\n`;
    } else if (data.deliveryCost !== undefined) {
      const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
      priceBreakdown += `Lieferkosten${distanceText}:   ${data.deliveryCost === 0 ? 'kostenlos' : formatPrice(data.deliveryCost)}\n`;
    }
  }

  const notesSection = data.notes ? `\nANMERKUNGEN DES KUNDEN\n${data.notes}\n` : '';

  let billingSection = '';
  if (data.billingAddress && data.billingAddress.name) {
    billingSection = `
RECHNUNGSADRESSE
${data.billingAddress.name}
${data.billingAddress.street}
${data.billingAddress.zip} ${data.billingAddress.city}
${data.billingAddress.country}
`;
  }

  const headerTitle = isEvent 
    ? 'NEUE EVENT-BUCHUNG EINGEGANGEN' 
    : 'NEUE CATERING-BESTELLUNG EINGEGANGEN';
  const orderLabel = isEvent ? 'Buchungsnummer' : 'Bestellnummer';
  const itemsLabel = isEvent ? 'GEBUCHTES PAKET' : 'BESTELLTE ARTIKEL';

  return `════════════════════════════════════════════
     ${headerTitle}
════════════════════════════════════════════
${paymentBanner}
${orderLabel}: ${data.orderNumber}
Eingegangen: ${now}

────────────────────────────────────────────
KUNDENDATEN
────────────────────────────────────────────

Name: ${data.customerName}
${data.companyName ? `Firma: ${data.companyName}\n` : ''}E-Mail: ${data.customerEmail}
Telefon: ${data.customerPhone}

────────────────────────────────────────────
${itemsLabel}
────────────────────────────────────────────

${itemsList}────────────────────────────────────────────
${priceBreakdown}────────────────────────────────────────────
GESAMTSUMME:                ${formatPrice(grandTotal)}
────────────────────────────────────────────

${isEvent ? 'VERANSTALTUNG' : 'TERMIN & LIEFERUNG'}

${deliveryInfo}
Datum: ${data.desiredDate ? formatDate(data.desiredDate) : 'Auf Anfrage'}
Uhrzeit: ${data.desiredTime ? data.desiredTime + ' Uhr' : 'Auf Anfrage'}
${notesSection}${billingSection}
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

  console.log(`Sending email via IONOS SMTP (SSL) to: ${to.join(', ')}, subject: ${subject}`);

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: true,  // Implicit SSL/TLS für Port 465
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: OrderNotificationRequest = await req.json();
    console.log("Received order notification request:", JSON.stringify(data, null, 2));

    const isPaid = data.paymentStatus === 'paid';
    const isEvent = data.isEventBooking === true;

    // Customer email subject - based on payment STATUS, not method
    const customerSubject = isEvent
      ? (isPaid
        ? `Ihre Event-Buchung bei STORIA (${data.orderNumber})`
        : `Ihre Event-Anfrage bei STORIA (${data.orderNumber})`)
      : (isPaid
        ? `Ihre Catering-Bestellung bei STORIA (${data.orderNumber})`
        : `Ihre Catering-Anfrage bei STORIA (${data.orderNumber})`);

    // Restaurant email subject
    const restaurantSubject = isEvent
      ? (isPaid
        ? `BEZAHLT: Neue Event-Buchung ${data.orderNumber}`
        : `Neue Event-Anfrage ${data.orderNumber}`)
      : (isPaid
        ? `BEZAHLT: Neue Bestellung ${data.orderNumber}`
        : `Neue Anfrage ${data.orderNumber}`);

    // Send customer confirmation
    const customerEmailText = generateCustomerEmailText(data);
    await sendEmail(
      [data.customerEmail],
      customerSubject,
      customerEmailText,
      "STORIA Catering"
    );

    // Send restaurant notification
    const restaurantEmailText = generateRestaurantEmailText(data);
    await sendEmail(
      ["info@events-storia.de"],
      restaurantSubject,
      restaurantEmailText,
      "STORIA Bestellsystem"
    );

    return new Response(
      JSON.stringify({ success: true, message: "Emails sent successfully via IONOS SMTP" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-order-notification function:", error);
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
