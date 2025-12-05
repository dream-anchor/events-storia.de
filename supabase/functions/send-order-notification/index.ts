import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  // New fields for detailed pricing
  subtotal: number;
  deliveryCost?: number;
  minimumOrderSurcharge?: number;
  distanceKm?: number;
  grandTotal: number;
  billingAddress?: BillingAddress;
  // Legacy field for backwards compatibility
  totalAmount?: number;
}

const formatPrice = (price: number) => price.toFixed(2).replace('.', ',') + ' €';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const generateCustomerEmailHtml = (data: OrderNotificationRequest) => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  // Build price breakdown
  let priceBreakdownHtml = `
    <tr>
      <td style="padding: 8px 0;">Zwischensumme (Warenwert)</td>
      <td style="padding: 8px 0; text-align: right;">${formatPrice(subtotal)}</td>
    </tr>
  `;
  
  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdownHtml += `
      <tr>
        <td style="padding: 8px 0; color: #8B7355;">Mindestbestellwert-Aufschlag</td>
        <td style="padding: 8px 0; text-align: right; color: #8B7355;">+${formatPrice(data.minimumOrderSurcharge)}</td>
      </tr>
    `;
  }
  
  if (!data.isPickup && data.deliveryCost !== undefined) {
    const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
    priceBreakdownHtml += `
      <tr>
        <td style="padding: 8px 0;">Lieferung${distanceText}</td>
        <td style="padding: 8px 0; text-align: right;">${data.deliveryCost === 0 ? 'Kostenlos' : formatPrice(data.deliveryCost)}</td>
      </tr>
    `;
  }

  // Billing address section
  let billingAddressHtml = '';
  if (data.billingAddress && data.billingAddress.name) {
    billingAddressHtml = `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px; color: #8B7355;">Rechnungsadresse</h4>
        <p style="margin: 0;">
          ${data.billingAddress.name}<br>
          ${data.billingAddress.street}<br>
          ${data.billingAddress.zip ? `${data.billingAddress.zip} ` : ''}${data.billingAddress.city}<br>
          ${data.billingAddress.country}
        </p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; background: #1a1a1a; color: #fff; }
        .header h1 { font-family: Georgia, serif; font-size: 28px; margin: 0; letter-spacing: 3px; }
        .content { padding: 30px; background: #fff; }
        .order-number { background: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .order-number span { font-family: monospace; font-size: 18px; font-weight: bold; color: #8B7355; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f9f9f9; padding: 12px; text-align: left; font-weight: 600; }
        .total-section { border-top: 2px solid #1a1a1a; padding-top: 15px; margin-top: 15px; }
        .grand-total { font-size: 20px; font-weight: bold; }
        .info-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>STORIA</h1>
        </div>
        <div class="content">
          <h2 style="color: #1a1a1a; margin-top: 0;">Vielen Dank für Ihre Anfrage!</h2>
          <p>Liebe/r ${data.customerName},</p>
          <p>wir haben Ihre Catering-Anfrage erhalten und werden uns innerhalb von 24 Stunden bei Ihnen melden.</p>
          
          <div class="order-number">
            Ihre Bestellnummer: <span>${data.orderNumber}</span>
          </div>
          
          <h3 style="border-bottom: 2px solid #8B7355; padding-bottom: 10px;">Ihre Auswahl</h3>
          <table>
            <thead>
              <tr>
                <th>Artikel</th>
                <th style="text-align: center;">Menge</th>
                <th style="text-align: right;">Preis</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="total-section">
            <table style="margin: 0;">
              ${priceBreakdownHtml}
              <tr class="grand-total">
                <td style="padding: 15px 0; border-top: 1px solid #ccc;">Gesamtsumme</td>
                <td style="padding: 15px 0; border-top: 1px solid #ccc; text-align: right;">${formatPrice(grandTotal)}</td>
              </tr>
            </table>
          </div>
          
          <div class="info-box">
            <h4 style="margin-top: 0;">Lieferdetails</h4>
            <p><strong>Lieferart:</strong> ${data.isPickup ? 'Selbstabholung' : 'Lieferung'}</p>
            ${data.deliveryAddress ? `<p><strong>Adresse:</strong> ${data.deliveryAddress}</p>` : ''}
            ${data.distanceKm ? `<p><strong>Entfernung:</strong> ${data.distanceKm.toFixed(1)} km</p>` : ''}
            ${data.desiredDate ? `<p><strong>Wunschtermin:</strong> ${formatDate(data.desiredDate)}${data.desiredTime ? ` um ${data.desiredTime} Uhr` : ''}</p>` : ''}
            ${data.notes ? `<p><strong>Anmerkungen:</strong> ${data.notes}</p>` : ''}
          </div>
          
          ${billingAddressHtml}
          
          <p style="margin-top: 30px;">Bei Fragen erreichen Sie uns unter:</p>
          <p>
            📞 089 18913323<br>
            ✉️ info@storia-restaurant.de
          </p>
        </div>
        <div class="footer">
          <p>STORIA<br>
          Prinzregentenstraße 85 · 81675 München<br>
          <a href="https://www.storia-restaurant.de" style="color: #8B7355;">www.storia-restaurant.de</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateRestaurantEmailHtml = (data: OrderNotificationRequest) => {
  const subtotal = data.subtotal || data.totalAmount || 0;
  const grandTotal = data.grandTotal || data.totalAmount || 0;
  
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: center;"><strong>${item.quantity}x</strong></td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatPrice(item.price)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const now = new Date().toLocaleString('de-DE', { 
    dateStyle: 'full', 
    timeStyle: 'short' 
  });

  // Build price breakdown
  let priceBreakdownHtml = `
    <tr>
      <td style="padding: 8px 15px;">Warenwert</td>
      <td style="padding: 8px 15px; text-align: right;">${formatPrice(subtotal)}</td>
    </tr>
  `;
  
  if (data.minimumOrderSurcharge && data.minimumOrderSurcharge > 0) {
    priceBreakdownHtml += `
      <tr style="background: #fff8e1;">
        <td style="padding: 8px 15px;">⚠️ Mindestbestellwert-Aufschlag</td>
        <td style="padding: 8px 15px; text-align: right;">+${formatPrice(data.minimumOrderSurcharge)}</td>
      </tr>
    `;
  }
  
  if (!data.isPickup && data.deliveryCost !== undefined) {
    const distanceText = data.distanceKm ? ` (${data.distanceKm.toFixed(1)} km)` : '';
    priceBreakdownHtml += `
      <tr>
        <td style="padding: 8px 15px;">Lieferkosten${distanceText}</td>
        <td style="padding: 8px 15px; text-align: right;">${data.deliveryCost === 0 ? 'Kostenlos' : formatPrice(data.deliveryCost)}</td>
      </tr>
    `;
  }

  // Billing address section
  let billingAddressHtml = '';
  if (data.billingAddress && data.billingAddress.name) {
    billingAddressHtml = `
      <div class="customer-info" style="background: #e8f5e9;">
        <h3 style="color: #2e7d32;">📄 Rechnungsadresse</h3>
        <p style="margin: 0;">
          <strong>${data.billingAddress.name}</strong><br>
          ${data.billingAddress.street}<br>
          ${data.billingAddress.zip ? `${data.billingAddress.zip} ` : ''}${data.billingAddress.city}<br>
          ${data.billingAddress.country}
        </p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: #8B7355; color: #fff; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .urgent { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .customer-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .customer-info h3 { margin-top: 0; color: #8B7355; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1a1a1a; color: #fff; padding: 12px; text-align: left; }
        .price-breakdown { background: #f0f0f0; margin: 20px 0; border-radius: 8px; overflow: hidden; }
        .price-breakdown table { margin: 0; }
        .grand-total { background: #1a1a1a; color: #fff; font-size: 18px; font-weight: bold; }
        .notes { background: #fff8e1; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .cta a { background: #8B7355; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ Neue Catering-Anfrage</h1>
          <p style="margin: 5px 0 0;">${data.orderNumber}</p>
        </div>
        
        <div class="urgent">
          <strong>⏰ Eingegangen:</strong> ${now}
        </div>
        
        <div class="customer-info">
          <h3>Kundendaten</h3>
          <table style="margin: 0;">
            <tr>
              <td style="padding: 5px 10px 5px 0; width: 120px;"><strong>Name:</strong></td>
              <td>${data.customerName}</td>
            </tr>
            ${data.companyName ? `
            <tr>
              <td style="padding: 5px 10px 5px 0;"><strong>Firma:</strong></td>
              <td>${data.companyName}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 5px 10px 5px 0;"><strong>E-Mail:</strong></td>
              <td><a href="mailto:${data.customerEmail}">${data.customerEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 5px 10px 5px 0;"><strong>Telefon:</strong></td>
              <td><a href="tel:${data.customerPhone}">${data.customerPhone}</a></td>
            </tr>
          </table>
        </div>
        
        <h3 style="color: #8B7355;">Bestellte Artikel</h3>
        <table>
          <thead>
            <tr>
              <th>Artikel</th>
              <th style="text-align: center;">Menge</th>
              <th style="text-align: right;">Einzelpreis</th>
              <th style="text-align: right;">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="price-breakdown">
          <table>
            ${priceBreakdownHtml}
            <tr class="grand-total">
              <td style="padding: 15px;">GESAMTSUMME</td>
              <td style="padding: 15px; text-align: right;">${formatPrice(grandTotal)}</td>
            </tr>
          </table>
        </div>
        
        <div class="customer-info">
          <h3>Lieferdetails</h3>
          <p><strong>Art:</strong> ${data.isPickup ? '🚗 Selbstabholung' : '🚚 Lieferung'}</p>
          ${data.deliveryAddress ? `<p><strong>Adresse:</strong> ${data.deliveryAddress}</p>` : ''}
          ${data.distanceKm ? `<p><strong>Entfernung:</strong> ${data.distanceKm.toFixed(1)} km vom Restaurant</p>` : ''}
          ${data.desiredDate ? `<p><strong>Wunschtermin:</strong> ${formatDate(data.desiredDate)}${data.desiredTime ? ` um ${data.desiredTime} Uhr` : ''}</p>` : '<p><em>Kein Wunschtermin angegeben</em></p>'}
        </div>
        
        ${billingAddressHtml}
        
        ${data.notes ? `
        <div class="notes">
          <h4 style="margin-top: 0;">📝 Anmerkungen des Kunden:</h4>
          <p style="margin-bottom: 0;">${data.notes}</p>
        </div>` : ''}
        
        <div class="cta">
          <a href="https://storia-restaurant.de/admin">Zur Admin-Übersicht →</a>
        </div>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-order-notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: OrderNotificationRequest = await req.json();
    console.log("Order data received:", JSON.stringify(data, null, 2));

    // Send customer confirmation email
    console.log("Sending customer email to:", data.customerEmail);
    const customerEmailResult = await resend.emails.send({
      from: "STORIA Catering <noreply@storia-restaurant.de>",
      to: [data.customerEmail],
      subject: `Ihre Catering-Anfrage bei STORIA (${data.orderNumber})`,
      html: generateCustomerEmailHtml(data),
    });
    console.log("Customer email result:", customerEmailResult);

    // Send restaurant notification email
    console.log("Sending restaurant notification email");
    const restaurantEmailResult = await resend.emails.send({
      from: "STORIA Website <noreply@storia-restaurant.de>",
      to: ["info@storia-restaurant.de"],
      subject: `🍽️ Neue Catering-Anfrage: ${data.orderNumber}`,
      html: generateRestaurantEmailHtml(data),
    });
    console.log("Restaurant email result:", restaurantEmailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
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