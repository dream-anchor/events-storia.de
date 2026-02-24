import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { getCorsHeaders } from '../_shared/cors.ts';



interface EventInquiryRequest {
  companyName?: string;
  contactName: string;
  email: string;
  phone?: string;
  guestCount?: string;
  eventType?: string;
  preferredDate?: string;
  timeSlot?: string;
  packageId?: string;
  message?: string;
  source?: string;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const getEventTypeLabel = (eventType: string): string => {
  const types: Record<string, string> = {
    'firmenfeier': 'Firmenfeier',
    'weihnachtsfeier': 'Weihnachtsfeier',
    'geburtstag': 'Geburtstagsfeier',
    'hochzeit': 'Hochzeit',
    'sommerfest': 'Sommerfest',
    'teamevent': 'Teamevent',
    'konferenz': 'Konferenz/Meeting',
    'sonstiges': 'Sonstiges',
  };
  return types[eventType] || eventType;
};

const generateCustomerEmailText = (data: EventInquiryRequest): string => {
  const eventTypeLabel = data.eventType ? getEventTypeLabel(data.eventType) : 'Nicht angegeben';
  const dateText = data.preferredDate ? formatDate(data.preferredDate) : 'Flexibel';
  const timeText = data.timeSlot || 'Nicht angegeben';

  return `STORIA · EVENTS & CATERING

Guten Tag ${data.contactName},

vielen Dank für Ihre Event-Anfrage!

Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen mit einem individuellen Angebot.


IHRE ANFRAGE

${data.companyName ? `Firma: ${data.companyName}\n` : ''}Ansprechpartner: ${data.contactName}
E-Mail: ${data.email}
${data.phone ? `Telefon: ${data.phone}\n` : ''}
Eventart: ${eventTypeLabel}
Gästeanzahl: ${data.guestCount || 'Nicht angegeben'}
Wunschtermin: ${dateText}
Uhrzeit: ${timeText} Uhr

${data.message ? `Ihre Nachricht:\n${data.message}\n` : ''}

Bei Fragen erreichen Sie uns unter:
Tel: +49 89 51519696
E-Mail: info@events-storia.de

STORIA · Ristorante
Karlstraße 47a
80333 München

events-storia.de
`;
};

const getSourceLabel = (source: string | undefined): string => {
  if (!source) return 'Website';
  // Convert technical source identifiers to human-readable labels
  if (source.startsWith('package_inquiry_')) return 'Paket-Anfrage (Website)';
  if (source === 'contact_form') return 'Kontaktformular';
  if (source === 'manual_entry') return 'Manuell erfasst';
  if (source === 'email') return 'E-Mail';
  if (source === 'phone') return 'Telefonisch';
  return source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, ' ');
};

const generateRestaurantEmailText = (data: EventInquiryRequest): string => {
  const now = new Date().toLocaleString('de-DE', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const eventTypeLabel = data.eventType ? getEventTypeLabel(data.eventType) : 'Nicht angegeben';
  const dateText = data.preferredDate ? formatDate(data.preferredDate) : 'Flexibel';
  const timeText = data.timeSlot || 'Nicht angegeben';
  const sourceLabel = getSourceLabel(data.source);

  return `NEUE EVENT-ANFRAGE EINGEGANGEN

Eingegangen: ${now}
Quelle: ${sourceLabel}
${data.eventType ? `Gewähltes Paket: ${data.eventType}\n` : ''}

KONTAKTDATEN

${data.companyName ? `Firma: ${data.companyName}\n` : ''}Ansprechpartner: ${data.contactName}
E-Mail: ${data.email}
${data.phone ? `Telefon: ${data.phone}\n` : ''}

EVENT-DETAILS

Eventart: ${eventTypeLabel}
Gästeanzahl: ${data.guestCount || 'Nicht angegeben'}
Wunschtermin: ${dateText}
Uhrzeit: ${timeText} Uhr

${data.message ? `Nachricht des Kunden:\n${data.message}\n` : ''}

Admin-Bereich: https://events-storia.de/admin
`;
};

async function sendEmail(to: string[], subject: string, text: string, fromName: string, replyTo?: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  console.log(`SMTP_HOST: ${smtpHost}, SMTP_PORT: ${smtpPort}`);

  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP credentials not configured (SMTP_USER, SMTP_PASSWORD)");
  }

  console.log(`Sending email via IONOS SMTP (SSL) to: ${to.join(', ')}, subject: ${subject}${replyTo ? `, replyTo: ${replyTo}` : ''}`);

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
      replyTo: replyTo,
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
    const data: EventInquiryRequest = await req.json();

    if (!data.contactName || !data.email) {
      return new Response(
        JSON.stringify({ error: "Name und E-Mail sind erforderlich" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate Limiting: Max 3 Anfragen pro E-Mail in 15 Minuten
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('event_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('email', data.email.toLowerCase().trim())
      .gte('created_at', fifteenMinAgo);

    if ((recentCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
        }
      );
    }

    const { data: inquiry, error: insertError } = await supabase
      .from('event_inquiries')
      .insert({
        company_name: data.companyName || null,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone || null,
        guest_count: data.guestCount || null,
        event_type: data.eventType || null,
        preferred_date: data.preferredDate || null,
        time_slot: data.timeSlot || null,
        selected_packages: data.packageId 
          ? [{ id: data.packageId, name: data.eventType }]
          : null,
        message: data.message || null,
        source: data.source || 'website',
        notification_sent: false,
        status: 'new',
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting inquiry:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log("Inquiry saved to database:", inquiry.id);

    let emailsSent = false;
    try {
      const customerEmailText = generateCustomerEmailText(data);
      await sendEmail(
        [data.email],
        "Ihre Event-Anfrage bei STORIA",
        customerEmailText,
        "STORIA Events"
      );

      const restaurantEmailText = generateRestaurantEmailText(data);
      await sendEmail(
        ["info@events-storia.de"],
        `Neue Event-Anfrage: ${data.companyName || data.contactName}`,
        restaurantEmailText,
        "STORIA Anfragen",
        data.email  // Reply-To Header - Antworten gehen direkt an den Kunden
      );

      emailsSent = true;
      console.log("All emails sent successfully");
    } catch (emailError: any) {
      console.error("Email sending failed (inquiry still saved):", emailError.message);
    }

    await supabase
      .from('event_inquiries')
      .update({ notification_sent: emailsSent })
      .eq('id', inquiry.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Anfrage erfolgreich gesendet",
        inquiryId: inquiry.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in receive-event-inquiry function:", error);
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
