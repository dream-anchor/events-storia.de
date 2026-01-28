import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventInquiryRequest {
  companyName?: string;
  contactName: string;
  email: string;
  phone?: string;
  guestCount?: string;
  eventType?: string;
  preferredDate?: string;
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

  return `════════════════════════════════════════════
          STORIA · EVENTS & CATERING
════════════════════════════════════════════

Guten Tag ${data.contactName},

vielen Dank für Ihre Event-Anfrage!

Wir haben Ihre Anfrage erhalten und melden uns 
innerhalb von 24 Stunden bei Ihnen mit einem 
individuellen Angebot.

────────────────────────────────────────────
IHRE ANFRAGE
────────────────────────────────────────────

${data.companyName ? `Firma: ${data.companyName}\n` : ''}Ansprechpartner: ${data.contactName}
E-Mail: ${data.email}
${data.phone ? `Telefon: ${data.phone}\n` : ''}
Eventart: ${eventTypeLabel}
Gästeanzahl: ${data.guestCount || 'Nicht angegeben'}
Wunschtermin: ${dateText}

${data.message ? `Ihre Nachricht:\n${data.message}\n` : ''}
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

const generateRestaurantEmailText = (data: EventInquiryRequest): string => {
  const now = new Date().toLocaleString('de-DE', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const eventTypeLabel = data.eventType ? getEventTypeLabel(data.eventType) : 'Nicht angegeben';
  const dateText = data.preferredDate ? formatDate(data.preferredDate) : 'Flexibel';

  return `════════════════════════════════════════════
       NEUE EVENT-ANFRAGE EINGEGANGEN
════════════════════════════════════════════

Eingegangen: ${now}
Quelle: ${data.source || 'Website'}

────────────────────────────────────────────
KONTAKTDATEN
────────────────────────────────────────────

${data.companyName ? `Firma: ${data.companyName}\n` : ''}Ansprechpartner: ${data.contactName}
E-Mail: ${data.email}
${data.phone ? `Telefon: ${data.phone}\n` : ''}
────────────────────────────────────────────
EVENT-DETAILS
────────────────────────────────────────────

Eventart: ${eventTypeLabel}
Gästeanzahl: ${data.guestCount || 'Nicht angegeben'}
Wunschtermin: ${dateText}

${data.message ? `NACHRICHT DES KUNDEN:\n${data.message}\n` : ''}
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
    const data: EventInquiryRequest = await req.json();
    console.log("Received event inquiry request:", JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.contactName || !data.email) {
      return new Response(
        JSON.stringify({ error: "Name und E-Mail sind erforderlich" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert inquiry into database
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

    // Send customer confirmation email
    const customerEmailText = generateCustomerEmailText(data);
    await sendEmail(
      [data.email],
      "Ihre Event-Anfrage bei STORIA",
      customerEmailText,
      "STORIA Events"
    );

    // Send restaurant notification email
    const restaurantEmailText = generateRestaurantEmailText(data);
    await sendEmail(
      ["info@events-storia.de"],
      `Neue Event-Anfrage: ${data.companyName || data.contactName}`,
      restaurantEmailText,
      "STORIA Anfragen"
    );

    // Update notification_sent flag
    await supabase
      .from('event_inquiries')
      .update({ notification_sent: true })
      .eq('id', inquiry.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Anfrage erfolgreich gesendet",
        inquiryId: inquiry.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in receive-event-inquiry function:", error);
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
