import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string[], subject: string, html: string, from: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  return response.json();
}

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
  isPickup: boolean;
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
}

const formatPrice = (price: number) => price.toFixed(2).replace('.', ',') + ' €';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const LOGO_URL = "https://ristorantestoria.de/storia-logo.webp";

const generateCustomerEmailHtml = (data: OrderNotificationRequest) => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e8e8e8; font-size: 15px; color: #333;">${item.name}</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e8e8e8; text-align: center; font-size: 15px; color: #666;">${item.quantity}</td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #e8e8e8; text-align: right; font-size: 15px; font-weight: 600; color: #333;">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  let priceBreakdownHtml = `
    <tr>
      <td style="padding: 10px 0; color: #555;">Zwischensumme (Warenwert)</td>
      <td style="padding: 10px 0; text-align: right; color: #333;">${formatPrice(subtotal)}</td>
    </tr>
  `;
  
  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdownHtml += `
      <tr>
        <td style="padding: 10px 0; color: #b8860b;">Mindestbestellwert-Aufschlag</td>
        <td style="padding: 10px 0; text-align: right; color: #b8860b;">+${formatPrice(data.minimumOrderSurcharge)}</td>
      </tr>
    `;
  }
  
  if (!data.isPickup && data.deliveryCost !== undefined) {
    const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
    priceBreakdownHtml += `
      <tr>
        <td style="padding: 10px 0; color: #555;">Lieferung${distanceText}</td>
        <td style="padding: 10px 0; text-align: right; color: #333;">${data.deliveryCost === 0 ? 'Kostenlos' : formatPrice(data.deliveryCost)}</td>
      </tr>
    `;
  }

  let billingAddressHtml = '';
  if (data.billingAddress && data.billingAddress.name) {
    billingAddressHtml = `
      <div style="background: #fafafa; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #eee;">
        <h4 style="margin: 0 0 12px; color: #c9a227; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 600;">Rechnungsadresse</h4>
        <p style="margin: 0; color: #555; line-height: 1.7;">
          ${data.billingAddress.name}<br>
          ${data.billingAddress.street}<br>
          ${data.billingAddress.zip ? `${data.billingAddress.zip} ` : ''}${data.billingAddress.city}<br>
          ${data.billingAddress.country}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ihre Catering-Anfrage bei STORIA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
              <img src="${LOGO_URL}" alt="STORIA" style="height: 70px; width: auto; margin-bottom: 16px;">
              <p style="color: #c9a227; font-family: Georgia, 'Times New Roman', serif; margin: 0; letter-spacing: 3px; font-size: 13px; text-transform: uppercase;">Catering &amp; Events</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 40px 35px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 600;">Vielen Dank für Ihre Anfrage!</h2>
              <p style="color: #555; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">Liebe/r ${data.customerName},</p>
              <p style="color: #555; font-size: 16px; line-height: 1.7; margin: 0 0 30px;">wir haben Ihre Catering-Anfrage erhalten und werden uns innerhalb von 24 Stunden bei Ihnen melden.</p>
              
              <!-- Order Number Box -->
              <div style="background: linear-gradient(135deg, #faf8f5 0%, #f5f2ed 100%); padding: 20px 24px; text-align: center; border-radius: 12px; margin: 0 0 32px; border: 1px solid #e8e4dc;">
                <p style="margin: 0 0 6px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Ihre Bestellnummer</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #c9a227; letter-spacing: 1px;">${data.orderNumber}</p>
              </div>
              
              <!-- Section Title -->
              <h3 style="color: #1a1a1a; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid #c9a227; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 600;">Ihre Auswahl</h3>
              
              <!-- Items Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                <thead>
                  <tr>
                    <th style="background: #fafafa; padding: 14px 16px; text-align: left; font-weight: 600; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eee;">Artikel</th>
                    <th style="background: #fafafa; padding: 14px 16px; text-align: center; font-weight: 600; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eee;">Menge</th>
                    <th style="background: #fafafa; padding: 14px 16px; text-align: right; font-weight: 600; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eee;">Preis</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <!-- Price Breakdown -->
              <div style="border-top: 2px solid #1a1a1a; padding-top: 20px; margin-top: 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 15px;">
                  ${priceBreakdownHtml}
                  <tr>
                    <td style="padding: 16px 0 0; border-top: 1px solid #ddd; font-size: 20px; font-weight: 700; color: #1a1a1a;">Gesamtsumme</td>
                    <td style="padding: 16px 0 0; border-top: 1px solid #ddd; text-align: right; font-size: 20px; font-weight: 700; color: #c9a227;">${formatPrice(grandTotal)}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Delivery Info Box -->
              <div style="background: #fafafa; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #eee;">
                <h4 style="margin: 0 0 16px; color: #c9a227; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 600;">Lieferdetails</h4>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 15px; color: #555;">
                  <tr>
                    <td style="padding: 6px 0; width: 120px; vertical-align: top;"><strong style="color: #333;">Lieferart:</strong></td>
                    <td style="padding: 6px 0;">${data.isPickup ? 'Selbstabholung' : 'Lieferung'}</td>
                  </tr>
                  ${data.deliveryAddress ? `
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;"><strong style="color: #333;">Adresse:</strong></td>
                    <td style="padding: 6px 0;">${data.deliveryAddress.replace(/\n/g, '<br>')}</td>
                  </tr>` : ''}
                  ${data.distanceKm ? `
                  <tr>
                    <td style="padding: 6px 0;"><strong style="color: #333;">Entfernung:</strong></td>
                    <td style="padding: 6px 0;">${data.distanceKm.toFixed(1)} km</td>
                  </tr>` : ''}
                  ${data.desiredDate ? `
                  <tr>
                    <td style="padding: 6px 0;"><strong style="color: #333;">Wunschtermin:</strong></td>
                    <td style="padding: 6px 0;">${formatDate(data.desiredDate)}${data.desiredTime ? ` um ${data.desiredTime} Uhr` : ''}</td>
                  </tr>` : ''}
                  ${data.notes ? `
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;"><strong style="color: #333;">Anmerkungen:</strong></td>
                    <td style="padding: 6px 0;">${data.notes}</td>
                  </tr>` : ''}
                </table>
              </div>
              
              ${billingAddressHtml}
              
              <!-- Contact Section -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                <p style="color: #555; font-size: 15px; margin: 0 0 12px;">Bei Fragen erreichen Sie uns unter:</p>
                <p style="margin: 0; font-size: 15px; line-height: 1.8;">
                  <a href="tel:+498918913323" style="color: #1a1a1a; text-decoration: none;">Tel: 089 18913323</a><br>
                  <a href="mailto:info@ristorantestoria.de" style="color: #c9a227; text-decoration: none;">info@ristorantestoria.de</a>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #1a1a1a; padding: 30px; text-align: center; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 8px; color: #c9a227; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; letter-spacing: 2px;">STORIA</p>
              <p style="margin: 0 0 4px; color: #888; font-size: 13px;">Ristorante Storia</p>
              <p style="margin: 0 0 12px; color: #888; font-size: 13px;">Karlstr. 47a · 80333 München</p>
              <a href="https://ristorantestoria.de" style="color: #c9a227; font-size: 13px; text-decoration: none;">ristorantestoria.de</a>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const generateRestaurantEmailHtml = (data: OrderNotificationRequest) => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e5e5e5; font-size: 14px;">${item.name}</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e5e5e5; text-align: center; font-weight: 700; font-size: 14px;">${item.quantity}x</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e5e5e5; text-align: right; font-size: 14px; color: #666;">${formatPrice(item.price)}</td>
      <td style="padding: 12px 14px; border-bottom: 1px solid #e5e5e5; text-align: right; font-size: 14px; font-weight: 600;">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const now = new Date().toLocaleString('de-DE', { 
    dateStyle: 'full', 
    timeStyle: 'short' 
  });

  let priceBreakdownHtml = `
    <tr>
      <td style="padding: 10px 16px; color: #555;">Warenwert</td>
      <td style="padding: 10px 16px; text-align: right;">${formatPrice(subtotal)}</td>
    </tr>
  `;
  
  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdownHtml += `
      <tr style="background: #fff8e1;">
        <td style="padding: 10px 16px; color: #b8860b;">Mindestbestellwert-Aufschlag</td>
        <td style="padding: 10px 16px; text-align: right; color: #b8860b;">+${formatPrice(data.minimumOrderSurcharge)}</td>
      </tr>
    `;
  }
  
  if (!data.isPickup && data.deliveryCost !== undefined) {
    const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
    priceBreakdownHtml += `
      <tr>
        <td style="padding: 10px 16px; color: #555;">Lieferkosten${distanceText}</td>
        <td style="padding: 10px 16px; text-align: right;">${data.deliveryCost === 0 ? 'Kostenlos' : formatPrice(data.deliveryCost)}</td>
      </tr>
    `;
  }

  let billingAddressHtml = '';
  if (data.billingAddress && data.billingAddress.name) {
    billingAddressHtml = `
      <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #4caf50;">
        <h3 style="margin: 0 0 12px; color: #2e7d32; font-size: 15px; font-weight: 600;">Rechnungsadresse</h3>
        <p style="margin: 0; color: #333; line-height: 1.6; font-size: 14px;">
          <strong>${data.billingAddress.name}</strong><br>
          ${data.billingAddress.street}<br>
          ${data.billingAddress.zip ? `${data.billingAddress.zip} ` : ''}${data.billingAddress.city}<br>
          ${data.billingAddress.country}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neue Catering-Anfrage</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0f0f0;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" width="700" cellspacing="0" cellpadding="0" style="max-width: 700px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #c9a227 0%, #a68520 100%); padding: 24px 30px; border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="STORIA" style="height: 40px; width: auto; filter: brightness(0) invert(1);">
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; color: #fff; font-size: 20px; font-weight: 700;">Neue Catering-Anfrage</p>
                    <p style="margin: 4px 0 0; color: rgba(255,255,255,0.9); font-size: 13px; font-family: 'Courier New', monospace;">${data.orderNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Timestamp -->
          <tr>
            <td style="background: #fff8e1; padding: 14px 24px; border-bottom: 1px solid #ffe082;">
              <p style="margin: 0; color: #f57c00; font-size: 14px;"><strong>Eingegangen:</strong> ${now}</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 28px;">
              
              <!-- Customer Info -->
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #e9ecef;">
                <h3 style="margin: 0 0 14px; color: #c9a227; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Kundendaten</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; width: 100px; color: #666;"><strong>Name:</strong></td>
                    <td style="padding: 6px 0; color: #333;">${data.customerName}</td>
                  </tr>
                  ${data.companyName ? `
                  <tr>
                    <td style="padding: 6px 0; color: #666;"><strong>Firma:</strong></td>
                    <td style="padding: 6px 0; color: #333;">${data.companyName}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding: 6px 0; color: #666;"><strong>E-Mail:</strong></td>
                    <td style="padding: 6px 0;"><a href="mailto:${data.customerEmail}" style="color: #c9a227; text-decoration: none;">${data.customerEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #666;"><strong>Telefon:</strong></td>
                    <td style="padding: 6px 0;"><a href="tel:${data.customerPhone}" style="color: #c9a227; text-decoration: none; font-weight: 600;">${data.customerPhone}</a></td>
                  </tr>
                </table>
              </div>
              
              <!-- Items -->
              <h3 style="color: #333; margin: 0 0 14px; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Bestellte Artikel</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <thead>
                  <tr>
                    <th style="background: #1a1a1a; color: #fff; padding: 12px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Artikel</th>
                    <th style="background: #1a1a1a; color: #fff; padding: 12px 14px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Menge</th>
                    <th style="background: #1a1a1a; color: #fff; padding: 12px 14px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Einzelpreis</th>
                    <th style="background: #1a1a1a; color: #fff; padding: 12px 14px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <!-- Price Breakdown -->
              <div style="background: #f5f5f5; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
                  ${priceBreakdownHtml}
                  <tr style="background: #1a1a1a;">
                    <td style="padding: 16px; color: #fff; font-size: 16px; font-weight: 700;">GESAMTSUMME</td>
                    <td style="padding: 16px; text-align: right; color: #c9a227; font-size: 18px; font-weight: 700;">${formatPrice(grandTotal)}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Delivery Info -->
              <div style="background: #e3f2fd; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
                <h3 style="margin: 0 0 12px; color: #1565c0; font-size: 15px; font-weight: 600;">Lieferdetails</h3>
                <p style="margin: 0 0 8px; font-size: 14px;"><strong>Art:</strong> ${data.isPickup ? 'Selbstabholung' : 'Lieferung'}</p>
                ${data.deliveryAddress ? `<p style="margin: 0 0 8px; font-size: 14px;"><strong>Adresse:</strong><br>${data.deliveryAddress.replace(/\n/g, '<br>')}</p>` : ''}
                ${data.distanceKm ? `<p style="margin: 0 0 8px; font-size: 14px;"><strong>Entfernung:</strong> ${data.distanceKm.toFixed(1)} km</p>` : ''}
                ${data.desiredDate ? `<p style="margin: 0; font-size: 14px;"><strong>Wunschtermin:</strong> ${formatDate(data.desiredDate)}${data.desiredTime ? ` um ${data.desiredTime} Uhr` : ''}</p>` : '<p style="margin: 0; font-size: 14px; color: #888;"><em>Kein Wunschtermin angegeben</em></p>'}
              </div>
              
              ${billingAddressHtml}
              
              ${data.notes ? `
              <div style="background: #fff8e1; padding: 20px; border-radius: 10px; margin-bottom: 24px; border-left: 4px solid #ffc107;">
                <h4 style="margin: 0 0 10px; color: #f57c00; font-size: 14px; font-weight: 600;">Anmerkungen des Kunden:</h4>
                <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6;">${data.notes}</p>
              </div>` : ''}
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 28px;">
                <a href="https://ristorantestoria.de/admin" style="display: inline-block; background: linear-gradient(135deg, #c9a227 0%, #a68520 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Zur Admin-Übersicht</a>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #333; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #888; font-size: 12px;">STORIA Catering · Karlstr. 47a · 80333 München</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-order-notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: OrderNotificationRequest = await req.json();
    console.log("Order data received:", JSON.stringify(data, null, 2));

    // Send customer confirmation email via Resend
    console.log("Sending customer email to:", data.customerEmail);
    const customerEmailResult = await sendEmail(
      [data.customerEmail],
      `Ihre Catering-Anfrage bei STORIA (${data.orderNumber})`,
      generateCustomerEmailHtml(data),
      "STORIA Catering <noreply@ristorantestoria.de>"
    );
    console.log("Customer email sent successfully:", customerEmailResult);

    // Send restaurant notification email via Resend
    console.log("Sending restaurant notification email");
    const restaurantEmailResult = await sendEmail(
      ["info@ristorantestoria.de"],
      `Neue Catering-Anfrage: ${data.orderNumber}`,
      generateRestaurantEmailHtml(data),
      "STORIA Website <noreply@ristorantestoria.de>"
    );
    console.log("Restaurant email sent successfully:", restaurantEmailResult);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Emails sent successfully",
        customerEmail: customerEmailResult,
        restaurantEmail: restaurantEmailResult
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-order-notification:", error);
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
