import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';



interface ResponseCopyRequest {
  inquiryId: string;
  customerEmail: string;
  selectedOptionLabel: string;
  customerNotes: string | null;
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

    // Sende per Resend (primär) oder SMTP
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const smtpUser = Deno.env.get('SMTP_USER')?.trim();
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    let sent = false;

    if (smtpUser && smtpPassword) {
      try {
        const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
        const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.ionos.de';
        const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');

        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: true,
            auth: { username: smtpUser, password: smtpPassword },
          },
        });

        await client.send({
          from: `STORIA Events <${smtpUser}>`,
          to: [customerEmail],
          subject: emailSubject,
          html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailBody}</div>
</body>
</html>`,
        });

        await client.close();
        sent = true;
        console.log('Response copy sent via SMTP to', customerEmail);
      } catch (smtpErr) {
        console.error('SMTP error:', smtpErr);
        // Fallback to Resend
        if (resendApiKey) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              from: 'STORIA Events <info@events-storia.de>',
              to: customerEmail,
              subject: emailSubject,
              text: emailBody,
            }),
          });
          sent = res.ok;
          if (!sent) console.error('Resend fallback error:', await res.text());
          else console.log('Response copy sent via Resend (fallback) to', customerEmail);
        }
      }
    } else if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          from: 'STORIA Events <info@events-storia.de>',
          to: customerEmail,
          subject: emailSubject,
          text: emailBody,
        }),
      });
      sent = res.ok;
      if (!sent) console.error('Resend error:', await res.text());
      else console.log('Response copy sent via Resend to', customerEmail);
    } else {
      console.warn('No email provider configured');
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: sent }),
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
