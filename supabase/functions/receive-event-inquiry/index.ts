import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

interface SendResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
  errorMessage: string | null;
}

async function sendEmail(to: string[], subject: string, text: string, fromName: string, replyTo?: string): Promise<SendResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  let sent = false;
  let provider = "";
  let messageId: string | null = null;
  let errorMessage: string | null = null;

  const htmlBody = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${text}</div>
</body>
</html>`;

  // Resend (primär)
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          from: `${fromName} <info@events-storia.de>`,
          to: to,
          subject: subject,
          html: htmlBody,
          text: text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        sent = true;
        provider = "resend";
        messageId = data.id || null;
        console.log(`Email sent via Resend to: ${to.join(", ")}`);
      } else {
        errorMessage = `Resend error: ${await res.text()}`;
        console.error(errorMessage);
      }
    } catch (resendErr) {
      errorMessage = resendErr instanceof Error ? resendErr.message : "Resend error";
      console.error("Resend exception:", errorMessage);
    }
  }

  // SMTP Fallback
  if (!sent && smtpUser && smtpPassword) {
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");

      const client = new SMTPClient({
        connection: { hostname: smtpHost, port: smtpPort, tls: true, auth: { username: smtpUser, password: smtpPassword } },
      });

      await client.send({ from: `${fromName} <${smtpUser}>`, to, replyTo, subject, html: htmlBody });
      await client.close();
      sent = true;
      provider = "ionos_smtp";
      errorMessage = null;
      console.log(`Email sent via IONOS SMTP (fallback) to: ${to.join(", ")}`);
    } catch (smtpErr) {
      errorMessage = smtpErr instanceof Error ? smtpErr.message : "SMTP error";
      console.error("SMTP fallback error:", errorMessage);
    }
  }

  if (!sent && !resendApiKey && !smtpUser) {
    errorMessage = "No email provider configured";
  }

  return { sent, provider, messageId, errorMessage };
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

    // Kunden-Bestätigung senden
    const customerEmailText = generateCustomerEmailText(data);
    const customerResult = await sendEmail(
      [data.email],
      "Ihre Event-Anfrage bei STORIA",
      customerEmailText,
      "STORIA Events"
    );

    // Kunden-Email loggen
    await supabase.from('email_delivery_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiry.id,
      recipient_email: data.email,
      recipient_name: data.contactName,
      subject: "Ihre Event-Anfrage bei STORIA",
      provider: customerResult.provider || 'none',
      provider_message_id: customerResult.messageId,
      status: customerResult.sent ? 'sent' : 'failed',
      error_message: customerResult.errorMessage,
      sent_by: 'system',
      metadata: { email_type: 'inquiry_confirmation_customer' },
    });

    // Restaurant-Benachrichtigung senden
    const restaurantEmailText = generateRestaurantEmailText(data);
    const restaurantSubject = `Neue Event-Anfrage: ${data.companyName || data.contactName}`;
    const restaurantResult = await sendEmail(
      ["info@events-storia.de"],
      restaurantSubject,
      restaurantEmailText,
      "STORIA Anfragen",
      data.email
    );

    // Restaurant-Email loggen
    await supabase.from('email_delivery_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiry.id,
      recipient_email: 'info@events-storia.de',
      recipient_name: 'STORIA Team',
      subject: restaurantSubject,
      provider: restaurantResult.provider || 'none',
      provider_message_id: restaurantResult.messageId,
      status: restaurantResult.sent ? 'sent' : 'failed',
      error_message: restaurantResult.errorMessage,
      sent_by: 'system',
      metadata: { email_type: 'inquiry_notification_restaurant' },
    });

    const emailsSent = customerResult.sent && restaurantResult.sent;

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
