import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

interface ResponseCopyRequest {
  inquiryId: string;
  customerEmail: string;
  selectedOptionLabel: string;
  customerNotes: string | null;
}

interface SendResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
  errorMessage: string | null;
}

async function sendEmail(to: string[], subject: string, html: string, fromName: string): Promise<SendResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  let sent = false;
  let provider = "";
  let messageId: string | null = null;
  let errorMessage: string | null = null;

  // 1) Resend (primär)
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
          to,
          subject,
          html,
          reply_to: 'info@events-storia.de',
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
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Resend error";
      console.error("Resend exception:", errorMessage);
    }
  }

  // 2) IONOS SMTP Fallback
  if (!sent && smtpUser && smtpPassword) {
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const client = new SMTPClient({
        connection: {
          hostname: Deno.env.get("SMTP_HOST") || "smtp.ionos.de",
          port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
          tls: true,
          auth: { username: smtpUser, password: smtpPassword },
        },
      });
      await client.send({ from: `${fromName} <${smtpUser}>`, to, subject, html });
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { inquiryId, customerEmail, selectedOptionLabel, customerNotes } =
      await req.json() as ResponseCopyRequest;

    if (!customerEmail || !inquiryId) {
      throw new Error('customerEmail and inquiryId are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const emailSubject = 'Ihre Rückmeldung zum STORIA-Angebot';
    const emailBody = `Vielen Dank für Ihre Rückmeldung!

Sie haben folgenden Vorschlag ausgewählt:
${selectedOptionLabel}

${customerNotes ? `Ihre Anmerkungen:\n${customerNotes}\n` : ''}
Wir melden uns in Kürze mit dem finalen Angebot bei Ihnen.

Bei Fragen erreichen Sie uns jederzeit:
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921

STORIA · Catering & Events
Karlstraße 47a
80333 München
Tel: +49 89 51519696
info@events-storia.de`;

    const htmlBody = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailBody}</div>
</body>
</html>`;

    const result = await sendEmail([customerEmail], emailSubject, htmlBody, "STORIA Events");

    // Email Delivery loggen
    await supabase.from('email_delivery_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiryId,
      recipient_email: customerEmail,
      subject: emailSubject,
      provider: result.provider || 'none',
      provider_message_id: result.messageId,
      status: result.sent ? 'sent' : 'failed',
      error_message: result.errorMessage,
      sent_by: 'system',
      metadata: {
        email_type: 'customer_response_copy',
        selectedOptionLabel,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailSent: result.sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
