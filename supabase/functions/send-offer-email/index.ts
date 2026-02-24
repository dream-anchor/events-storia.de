import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface SendOfferEmailRequest {
  inquiryId: string;
  emailContent: string;
  customerEmail: string;
  customerName: string;
  senderEmail?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { inquiryId, emailContent, customerEmail, customerName, senderEmail } =
      await req.json() as SendOfferEmailRequest;

    if (!inquiryId || !emailContent || !customerEmail) {
      throw new Error('inquiryId, emailContent and customerEmail are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Offer-URL generieren
    const offerUrl = `https://events-storia.de/offer/${inquiryId}`;

    // Email-Body: Anschreiben + Offer-Link
    const emailBodyWithLink = `${emailContent}

─────────────────────────────
Das vollständige Angebot mit allen Details finden Sie hier:
${offerUrl}

Über diesen Link können Sie das Angebot jederzeit einsehen, Ihren Favoriten wählen und uns direkt antworten.`;

    const emailSubject = `Ihr Angebot von STORIA Events`;

    // HTML-Version
    const htmlBody = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${escapeHtml(emailContent)}</div>
  <hr style="border: none; border-top: 1px solid #ccc; margin: 24px 0;">
  <p style="font-size: 14px; color: #555;">
    Das vollständige Angebot mit allen Details finden Sie hier:<br>
    <a href="${offerUrl}" style="color: #b45309; font-weight: 600;">${offerUrl}</a>
  </p>
  <p style="font-size: 13px; color: #777;">
    Über diesen Link können Sie das Angebot jederzeit einsehen, Ihren Favoriten wählen und uns direkt antworten.
  </p>
</body>
</html>`;

    // Sende per Resend (primär) oder SMTP (fallback)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const smtpUser = Deno.env.get('SMTP_USER')?.trim();
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    let sent = false;
    let provider = '';
    let messageId: string | null = null;
    let errorMessage: string | null = null;

    // Resend (primär)
    if (resendApiKey) {
      try {
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
            html: htmlBody,
            text: emailBodyWithLink,
            reply_to: 'info@events-storia.de',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          sent = true;
          provider = 'resend';
          messageId = data.id || null;
          errorMessage = null;
          console.log('Offer email sent via Resend to', customerEmail);
        } else {
          errorMessage = `Resend error: ${await res.text()}`;
          console.error(errorMessage);
        }
      } catch (resendErr) {
        errorMessage = resendErr instanceof Error ? resendErr.message : 'Resend error';
        console.error('Resend exception:', errorMessage);
      }
    }

    // SMTP Fallback (nur wenn Resend fehlschlug)
    if (!sent && smtpUser && smtpPassword) {
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
          content: emailBodyWithLink,
          html: htmlBody,
          replyTo: smtpUser,
        });

        await client.close();
        sent = true;
        provider = 'ionos_smtp';
        errorMessage = null;
        console.log('Offer email sent via IONOS SMTP (fallback) to', customerEmail);
      } catch (smtpErr) {
        errorMessage = smtpErr instanceof Error ? smtpErr.message : 'SMTP error';
        console.error('SMTP fallback error:', errorMessage);
      }
    }

    if (!sent && !resendApiKey && !smtpUser) {
      errorMessage = 'No email provider configured (Resend or SMTP)';
      console.warn(errorMessage);
    }

    // Log email delivery
    await supabase.from('email_delivery_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiryId,
      recipient_email: customerEmail,
      recipient_name: customerName,
      subject: emailSubject,
      provider: provider || 'none',
      provider_message_id: messageId,
      status: sent ? 'sent' : 'failed',
      error_message: errorMessage,
      sent_by: senderEmail || null,
      metadata: {
        email_type: 'offer_email',
        offer_url: offerUrl,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailSent: sent, provider, offerUrl }),
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
