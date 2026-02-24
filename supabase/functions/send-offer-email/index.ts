import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

interface SendOfferEmailRequest {
  inquiryId: string;
  emailContent: string;
  customerEmail: string;
  customerName: string;
  senderEmail?: string;
  offerSlug?: string;
}

interface SendResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
  errorMessage: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function generateOfferSlug(name: string, inquiryId: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const hash = inquiryId.replace(/-/g, '').substring(0, 4);
  return `${slug}-${hash}`;
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
    const { inquiryId, emailContent, customerEmail, customerName, senderEmail, offerSlug: providedSlug } =
      await req.json() as SendOfferEmailRequest;

    if (!inquiryId || !emailContent || !customerEmail) {
      throw new Error('inquiryId, emailContent and customerEmail are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Slug generieren oder verwenden + in DB speichern
    const slug = providedSlug || generateOfferSlug(customerName || 'angebot', inquiryId);
    await supabase
      .from('event_inquiries')
      .update({ offer_slug: slug } as Record<string, unknown>)
      .eq('id', inquiryId);

    const offerUrl = `https://events-storia.de/ihr-angebot/${slug}`;

    const emailBodyWithLink = `Ihr persönliches Angebot ist online bereit:
${offerUrl}

Dort finden Sie alle Details, können Ihren Favoriten wählen und das Angebot als PDF herunterladen.

─────────────────────────────

${emailContent}`;

    const emailSubject = `Ihr Angebot von STORIA Events`;

    const htmlBody = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <p style="font-size: 16px; color: #555; margin-bottom: 16px;">
      Ihr persönliches Angebot ist online bereit:
    </p>
    <a href="${offerUrl}" style="display: inline-block; background-color: #b45309; color: #ffffff; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 999px; text-decoration: none; letter-spacing: 0.02em;">
      Angebot ansehen
    </a>
    <p style="font-size: 13px; color: #999; margin-top: 12px;">
      Dort können Sie alle Details einsehen, Ihren Favoriten wählen und das Angebot als PDF herunterladen.
    </p>
  </div>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
  <div style="white-space: pre-wrap; font-size: 15px; color: #444;">${escapeHtml(emailContent)}</div>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;">
  <p style="font-size: 12px; color: #aaa; text-align: center;">
    <a href="${offerUrl}" style="color: #b45309;">${offerUrl}</a>
  </p>
</body>
</html>`;

    const result = await sendEmail([customerEmail], emailSubject, htmlBody, "STORIA Events");

    // Log email delivery
    await supabase.from('email_delivery_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiryId,
      recipient_email: customerEmail,
      recipient_name: customerName,
      subject: emailSubject,
      provider: result.provider || 'none',
      provider_message_id: result.messageId,
      status: result.sent ? 'sent' : 'failed',
      error_message: result.errorMessage,
      sent_by: senderEmail || null,
      metadata: {
        email_type: 'offer_email',
        offer_url: offerUrl,
        offer_slug: slug,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailSent: result.sent, provider: result.provider, offerUrl, offerSlug: slug }),
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
