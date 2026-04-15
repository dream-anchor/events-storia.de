import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';

interface SendOfferEmailRequest {
  inquiryId: string;
  emailContent: string;
  customerEmail: string;
  customerName: string;
  senderEmail?: string;
  offerSlug?: string;
  /** LexOffice-Quotation-ID — falls vorhanden, wird PDF angehängt */
  lexofficeQuotationId?: string | null;
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

/** Wartet auf das LexOffice-PDF mit Retry-Loop (Backoff). */
async function waitForLexOfficePdf(
  quotationId: string,
  apiKey: string,
  maxRetries = 5,
  initialDelayMs = 2000,
): Promise<Uint8Array | null> {
  for (let i = 0; i < maxRetries; i++) {
    const delay = initialDelayMs * Math.pow(1.5, i);
    await new Promise(r => setTimeout(r, delay));

    try {
      // 1. Document-ID abrufen
      const docRes = await fetch(
        `https://api.lexoffice.io/v1/quotations/${quotationId}/document`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      if (docRes.status === 406) {
        console.log(`PDF not ready yet (attempt ${i + 1}/${maxRetries}), retrying…`);
        continue;
      }
      if (!docRes.ok) {
        console.error(`Document endpoint returned ${docRes.status}`);
        continue;
      }

      const docData = await docRes.json();
      const documentFileId = docData.documentFileId;
      if (!documentFileId) continue;

      // 2. PDF-Datei abrufen
      const fileRes = await fetch(
        `https://api.lexoffice.io/v1/files/${documentFileId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      if (!fileRes.ok) {
        console.error(`File endpoint returned ${fileRes.status}`);
        continue;
      }

      const buffer = await fileRes.arrayBuffer();
      console.log(`PDF fetched successfully on attempt ${i + 1}, size: ${buffer.byteLength} bytes`);
      return new Uint8Array(buffer);
    } catch (err) {
      console.error(`PDF fetch attempt ${i + 1} failed:`, err);
    }
  }

  console.warn(`PDF not available after ${maxRetries} attempts`);
  return null;
}

async function sendEmail(
  to: string[],
  subject: string,
  html: string,
  fromName: string,
  pdfBuffer: Uint8Array | null,
  customerName: string,
  bcc?: string[],
  replyTo?: string,
): Promise<SendResult> {
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
      const payload: Record<string, unknown> = {
        from: `${fromName} <info@events-storia.de>`,
        to,
        bcc: bcc && bcc.length > 0 ? bcc : undefined,
        subject,
        html,
        reply_to: replyTo || 'info@events-storia.de',
      };

      if (pdfBuffer) {
        const base64Pdf = btoa(String.fromCharCode(...pdfBuffer));
        const safeName = (customerName || 'Kunde').replace(/[^a-zA-ZäöüÄÖÜß0-9\s-]/g, '').trim();
        payload.attachments = [{
          filename: `STORIA_Angebot_${safeName}.pdf`,
          content: base64Pdf,
        }];
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        sent = true;
        provider = "resend";
        messageId = data.id || null;
        console.log(`Email sent via Resend to: ${to.join(", ")} (pdf: ${!!pdfBuffer})`);
      } else {
        errorMessage = `Resend error: ${await res.text()}`;
        console.error(errorMessage);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Resend error";
      console.error("Resend exception:", errorMessage);
    }
  }

  // 2) IONOS SMTP Fallback (ohne PDF-Anhang)
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
    const body = await req.json() as SendOfferEmailRequest;
    const { inquiryId, emailContent, customerEmail, customerName, senderEmail, offerSlug: providedSlug, lexofficeQuotationId } = body;

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

    // Check if this is a test inquiry
    const { data: inquiryRow } = await supabase
      .from('event_inquiries')
      .select('is_test')
      .eq('id', inquiryId)
      .single();
    const isTest = inquiryRow?.is_test === true;

    const safeCustomerEmail = getSafeRecipientEmail(customerEmail, isTest);

    const offerUrl = `https://events-storia.de/offer/${inquiryId}`;

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

    // LexOffice-PDF abrufen (falls quotationId vorhanden)
    let pdfBuffer: Uint8Array | null = null;
    let hasPdf = false;

    if (lexofficeQuotationId) {
      const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
      if (lexofficeApiKey) {
        console.log(`Fetching LexOffice PDF for quotation ${lexofficeQuotationId}…`);
        pdfBuffer = await waitForLexOfficePdf(lexofficeQuotationId, lexofficeApiKey);
        hasPdf = !!pdfBuffer;
        if (!hasPdf) {
          console.warn('PDF not available — sending email without attachment');
        }
      }
    }

    const bccList = ['info@events-storia.de'];
    if (senderEmail && senderEmail !== 'info@events-storia.de') {
      bccList.push(senderEmail);
    }

    const replyToAddress = `reply+${inquiryId}@events-storia.de`;
    const safeSubject = getSafeSubject(emailSubject, isTest);
    const result = await sendEmail([safeCustomerEmail], safeSubject, htmlBody, "STORIA Events", pdfBuffer, customerName, bccList, replyToAddress);

    // Betreiber-Benachrichtigung: Versand fehlgeschlagen
    if (!result.sent) {
      const ownerHtml = `
        <h3>E-Mail-Versand fehlgeschlagen</h3>
        <p>Die Angebots-Mail an <strong>${escapeHtml(customerEmail)}</strong>
        (${escapeHtml(customerName || 'Unbekannt')}) konnte nicht zugestellt werden.</p>
        <p><strong>Fehler:</strong> ${escapeHtml(result.errorMessage || 'Unbekannt')}</p>
        <p><a href="https://events-storia.de/admin/events/${escapeHtml(inquiryId)}/edit">Im Maestro öffnen</a></p>
      `;
      await sendEmail(
        ['info@events-storia.de'],
        '⚠️ Mail-Versand fehlgeschlagen: ' + (customerName || customerEmail),
        ownerHtml, 'STORIA System', null, '',
      ).catch(e => console.error('Owner notification (failed) error:', e));
    }

    // Betreiber-Benachrichtigung: Mail ohne PDF-Anhang versendet
    if (result.sent && lexofficeQuotationId && !hasPdf) {
      const ownerHtml = `
        <h3>Angebots-Mail ohne PDF versendet</h3>
        <p>Mail an <strong>${escapeHtml(customerEmail)}</strong> versendet,
        aber LexOffice-PDF konnte nicht angehängt werden.</p>
        <p><a href="https://events-storia.de/admin/events/${escapeHtml(inquiryId)}/edit">Im Maestro öffnen</a></p>
      `;
      await sendEmail(
        ['info@events-storia.de'],
        '⚠️ Angebot ohne PDF: ' + (customerName || customerEmail),
        ownerHtml, 'STORIA System', null, '',
      ).catch(e => console.error('Owner notification (no-pdf) error:', e));
    }

    // Email Delivery Log
    await supabase.from('email_delivery_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiryId,
      recipient_email: customerEmail,
      recipient_name: customerName,
      subject: emailSubject,
      provider: result.provider || 'none',
      provider_message_id: result.messageId,
      status: result.sent ? 'queued' : 'failed',
      error_message: result.errorMessage,
      sent_by: senderEmail || null,
      metadata: {
        email_type: 'offer_email',
        offer_url: offerUrl,
        offer_slug: slug,
        has_pdf_attachment: hasPdf,
        lexoffice_quotation_id: lexofficeQuotationId || null,
        resend_message_id: result.messageId,
      },
    });

    // E-Mail in email_messages speichern (Thread-Konversation)
    if (result.sent) {
      const safeName = (customerName || 'Kunde').replace(/[^a-zA-ZäöüÄÖÜß0-9\s-]/g, '').trim();
      await supabase.from('email_messages').insert({
        inquiry_id: inquiryId,
        direction: 'outbound',
        from_email: 'info@events-storia.de',
        to_email: customerEmail,
        subject: emailSubject,
        body_text: emailContent,
        body_html: htmlBody,
        attachments: hasPdf ? [{ filename: `STORIA_Angebot_${safeName}.pdf` }] : [],
        resend_message_id: result.messageId,
        resend_status: 'queued',
      } as Record<string, unknown>);
    }

    // Activity Log
    await supabase.from('activity_logs').insert({
      entity_type: 'event_inquiry',
      entity_id: inquiryId,
      action: result.sent ? 'offer_email_sent' : 'offer_email_failed',
      actor_email: senderEmail || 'system',
      metadata: {
        recipient: customerEmail,
        subject: emailSubject,
        has_pdf_attachment: hasPdf,
        lexoffice_quotation_id: lexofficeQuotationId || null,
        resend_message_id: result.messageId,
        provider: result.provider,
        error: result.errorMessage,
      },
    });

    const warnings: string[] = [];
    if (lexofficeQuotationId && !hasPdf) {
      warnings.push('PDF nicht verfügbar — Mail ohne Anhang versendet');
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: result.sent,
        provider: result.provider,
        offerUrl,
        offerSlug: slug,
        hasPdfAttachment: hasPdf,
        warnings,
      }),
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
