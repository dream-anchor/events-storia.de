import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';
import { resolveV2Event } from '../_shared/v2-lookup.ts';

interface SendOfferEmailRequest {
  inquiryId: string;
  emailContent: string;
  customerEmail: string;
  customerName: string;
  senderEmail?: string;
  offerSlug?: string;
  /** LexOffice-Quotation-ID — falls vorhanden, wird PDF angehängt */
  lexofficeQuotationId?: string | null;
  /** Wenn true: Mail geht als Vorschau/Testmail an antoine@monot.com, unabhaengig von is_test.
   *  DB wird dabei NICHT aktualisiert (keine Phase-Änderung, keine History). */
  isTestPreview?: boolean;
  /** Wenn true: nichts senden, nichts loggen — nur das gerenderte Mail-Objekt zurueckgeben.
   *  Wird vom WYSIWYG-Preview-Screen genutzt. */
  dryRun?: boolean;
  /** Reply-Modus: überschreibt das gerenderte HTML-Template. */
  emailHtml?: string;
  /** Reply-Modus: überschreibt den Default-Subject "Ihr Angebot von STORIA Events". */
  emailSubject?: string;
  /** Zusätzliche CC-Empfänger (z.B. aus dem Composer). */
  cc?: string[];
  /** Zusätzliche BCC-Empfänger — werden mit dem Archiv-BCC kombiniert (deduped). */
  bcc?: string[];
  /** Threading: Message-ID der Mail, auf die geantwortet wird. */
  inReplyTo?: string | null;
  /** Threading: References-Header der Original-Mail (Array oder Space-getrennt). */
  references?: string[] | string | null;
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
  cc?: string[],
  headers?: Record<string, string>,
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
        cc: cc && cc.length > 0 ? cc : undefined,
        bcc: bcc && bcc.length > 0 ? bcc : undefined,
        subject,
        html,
        reply_to: replyTo || 'info@events-storia.de',
        headers: headers && Object.keys(headers).length > 0 ? headers : undefined,
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
    const {
      inquiryId, emailContent, customerEmail, customerName, senderEmail,
      offerSlug: providedSlug, lexofficeQuotationId, isTestPreview, dryRun,
      emailHtml: overrideHtml, emailSubject: overrideSubject,
      cc: extraCc, bcc: extraBcc,
      inReplyTo, references,
    } = body;
    const confirmedOperatorOverride = (body as { confirmedOperatorOverride?: boolean }).confirmedOperatorOverride === true;
    const isReplyMode = !!(overrideHtml && overrideHtml.trim());

    // Im dryRun reicht es wenn die Inquiry existiert — emailContent / customerEmail
    // duerfen leer sein. Wir liefern dann eine Vorschau mit Warnungen zurueck,
    // damit das UI dem Admin sagen kann was noch fehlt (statt eines harten 400).
    if (!inquiryId) {
      return new Response(
        JSON.stringify({ success: false, error: 'inquiryId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }
    if (!dryRun && (!emailContent || !customerEmail)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: !emailContent
            ? 'Kein Anschreiben vorhanden. Bitte zur Bearbeitung zurueck und Anschreiben erstellen oder generieren.'
            : 'Keine Empfaenger-E-Mail vorhanden.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    // Operator-Email-Guard (Defense in Depth)
    // Verhindert Versand an Betreiber-Adressen ohne explizite Admin-Bestaetigung.
    if (!dryRun && !isTestPreview && customerEmail) {
      const operatorDomains = [
        'events-storia.de', 'www.events-storia.de',
        'ristorantestoria.de', 'www.ristorantestoria.de',
        'storia-events.de', 'www.storia-events.de',
      ];
      const normalized = customerEmail.trim().toLowerCase();
      const at = normalized.indexOf('@');
      const domain = at >= 0 ? normalized.slice(at + 1) : '';
      const isOperator = operatorDomains.some(
        (d) => domain === d || domain.endsWith('.' + d),
      );
      if (isOperator && !confirmedOperatorOverride) {
        console.warn('[send-offer-email] BLOCKED operator recipient', {
          inquiryId, customerEmail,
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'OPERATOR_EMAIL_BLOCKED',
            message:
              `Empfänger ${customerEmail} ist eine Betreiber-Adresse. ` +
              `Versand ohne explizite Bestätigung blockiert.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve v2_event regardless of whether inquiryId is a legacy or v2 UUID
    const event = await resolveV2Event(supabase, inquiryId);
    if (!event) {
      return new Response(
        JSON.stringify({ success: false, error: `v2_event not found for ${inquiryId}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      );
    }

    // Slug generieren oder verwenden + in DB speichern (nicht im dryRun)
    const slug = providedSlug || generateOfferSlug(customerName || 'angebot', inquiryId);
    if (!dryRun) {
      await supabase
        .from('v2_events')
        .update({ offer_slug: slug } as Record<string, unknown>)
        .eq('id', event.id);
    }

    // isTest kommt aus dem v2_event. Fuer Preview-Testmails wird
    // Empfaenger/Subject unten gesondert ueberschrieben (isTestPreview-Block).
    const isTest = event.is_test === true;
    const safeCustomerEmail = getSafeRecipientEmail(customerEmail, isTest);

    const offerUrl = `https://events-storia.de/offer/${inquiryId}`;

    const emailSubject = (overrideSubject && overrideSubject.trim())
      ? overrideSubject.trim()
      : `Ihr Angebot von STORIA Events`;

    // Anschreiben-Text aufbereiten:
    // 1. Redundante URL-Erwähnung entfernen (CTA-Button oben ist prominenter)
    // 2. 3+ aufeinanderfolgende Newlines → exakt 2 (saubere Leerzeile)
    const cleanedEmailContent = emailContent
      .replace(/^.*(?:Angebot|Details).*(?:finden|sehen|einsehen).*?https?:\/\/\S+.*$/gim, '')
      .replace(/^\s*https?:\/\/\S*(?:\/offer\/|\/ihr-angebot\/|\/your-offer\/)\S*\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const templateHtml = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(emailSubject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf6f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
  <!-- Preheader (versteckt, sichtbar nur in Inbox-Preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    Ihr persönliches Angebot ist online bereit. Jetzt ansehen und buchen.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf6f0; padding: 32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.04);">

        <!-- Header mit STORIA-Branding -->
        <tr><td style="padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #f0ead8;">
          <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: normal; color: #1a1a1a; letter-spacing: 0.08em;">STORIA</h1>
          <p style="margin: 6px 0 0; font-size: 11px; color: #999; letter-spacing: 0.18em; text-transform: uppercase;">Catering &amp; Events &mdash; München</p>
        </td></tr>

        <!-- CTA-Bereich -->
        <tr><td style="padding: 32px; text-align: center;">
          <p style="margin: 0 0 20px; font-size: 16px; color: #555;">
            Ihr persönliches Angebot ist online bereit:
          </p>
          <a href="${offerUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #b45309; color: #ffffff; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 999px; text-decoration: none; letter-spacing: 0.02em; box-shadow: 0 4px 12px rgba(180,83,9,0.25);">
            Angebot ansehen
          </a>
          <p style="margin: 16px 0 0; font-size: 13px; color: #999;">
            Alle Details einsehen, Favoriten wählen und bequem online buchen.
          </p>
        </td></tr>

        <!-- Anschreiben (Admin-Text) -->
        <tr><td style="padding: 0 32px 32px;">
          <div style="border-top: 1px solid #e5e5e5; padding-top: 24px; white-space: pre-wrap; font-size: 15px; color: #444;">${escapeHtml(cleanedEmailContent)}</div>
        </td></tr>

        <!-- Footer mit Kontakt -->
        <tr><td style="padding: 24px 32px; background-color: #faf6f0; text-align: center; border-top: 1px solid #f0ead8;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #666;">
            <strong>STORIA Catering &amp; Events</strong><br>
            Karlstraße 43, 80333 München
          </p>
          <p style="margin: 8px 0 0; font-size: 13px;">
            <a href="tel:+498951519696" style="color: #b45309; text-decoration: none;">089 51519696</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:info@events-storia.de" style="color: #b45309; text-decoration: none;">info@events-storia.de</a>
          </p>
          <p style="margin: 16px 0 0; font-size: 11px; color: #aaa;">
            <a href="${offerUrl}" target="_blank" rel="noopener noreferrer" style="color: #aaa; word-break: break-all;">${offerUrl}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Reply-Modus: vom Composer geliefertes HTML 1:1 verwenden, sonst Template.
    const htmlBody = isReplyMode ? (overrideHtml as string) : templateHtml;

    // LexOffice-PDF abrufen (falls quotationId vorhanden) — im dryRun nur Verfügbarkeitscheck (kein Wait-Loop)
    let pdfBuffer: Uint8Array | null = null;
    let hasPdf = false;
    const safeName = (customerName || 'Kunde').replace(/[^a-zA-ZäöüÄÖÜß0-9\s-]/g, '').trim();
    const attachmentFilename = `STORIA_Angebot_${safeName}.pdf`;

    if (lexofficeQuotationId) {
      const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
      if (lexofficeApiKey) {
        if (dryRun) {
          // Nur ein schneller HEAD-artiger Check — wir wollen die Preview nicht 30s blockieren.
          try {
            const docRes = await fetch(
              `https://api.lexoffice.io/v1/quotations/${lexofficeQuotationId}/document`,
              { headers: { Authorization: `Bearer ${lexofficeApiKey}` } },
            );
            hasPdf = docRes.ok;
          } catch {
            hasPdf = false;
          }
        } else {
          console.log(`Fetching LexOffice PDF for quotation ${lexofficeQuotationId}…`);
          pdfBuffer = await waitForLexOfficePdf(lexofficeQuotationId, lexofficeApiKey);
          hasPdf = !!pdfBuffer;
          if (!hasPdf) {
            console.warn('PDF not available — sending email without attachment');
          }
        }
      }
    }

    // Archiv-BCC: Bei jedem regulaeren Kunden-Versand wird info@events-storia.de
    // als BCC mitgesendet, damit das Buero ein Archiv aller versendeten Angebote
    // hat. Bei Test-Inquiries (is_test) wird kein BCC gesetzt.
    const ARCHIVE_BCC = 'info@events-storia.de';
    const bccList: string[] = [];
    if (!event.is_test) bccList.push(ARCHIVE_BCC);
    if (extraBcc && extraBcc.length > 0) {
      for (const b of extraBcc) {
        const t = (b || '').trim();
        if (t && !bccList.some((x) => x.toLowerCase() === t.toLowerCase())) bccList.push(t);
      }
    }
    const ccList: string[] = [];
    if (extraCc && extraCc.length > 0) {
      for (const c of extraCc) {
        const t = (c || '').trim();
        if (t && !ccList.some((x) => x.toLowerCase() === t.toLowerCase())) ccList.push(t);
      }
    }

    // Threading-Header für Replies
    const threadingHeaders: Record<string, string> = {};
    if (inReplyTo) {
      const irt = inReplyTo.startsWith('<') ? inReplyTo : `<${inReplyTo}>`;
      threadingHeaders['In-Reply-To'] = irt;
    }
    if (references) {
      const refsArr = Array.isArray(references)
        ? references
        : String(references).split(/\s+/).filter(Boolean);
      const formatted = refsArr
        .map((r) => (r.startsWith('<') ? r : `<${r}>`))
        .join(' ');
      if (formatted) threadingHeaders['References'] = formatted;
    }

    const replyToAddress = 'info@events-storia.de';
    const safeSubject = getSafeSubject(emailSubject, isTest);

    // Preview-Testmail-Override (nur fuer echten Versand relevant)
    let previewTo: string[] | null = null;
    let previewSubject: string | null = null;
    let previewBcc: string[] | null = null;
    let previewCc: string[] | null = null;
    if (isTestPreview) {
      const PREVIEW_STANDARD_RECIPIENTS = ['antoine@monot.com', 'info@ristorantestoria.de'];
      const recipients = [...PREVIEW_STANDARD_RECIPIENTS];
      const adminEmail = senderEmail?.trim();
      if (adminEmail && !recipients.some((r) => r.toLowerCase() === adminEmail.toLowerCase())) {
        recipients.push(adminEmail);
      }
      previewTo = recipients;
      previewSubject = `VORSCHAU – ${emailSubject}`;
      previewBcc = [];
      previewCc = [];
    }

    const finalTo = previewTo || [safeCustomerEmail];
    const finalSubject = previewSubject || safeSubject;
    const finalBcc = previewBcc !== null ? previewBcc : bccList;
    const finalCc = previewCc !== null ? previewCc : ccList;
    const fromName = "STORIA Events";
    const fromAddress = `${fromName} <info@events-storia.de>`;

    // ----- DRY RUN: nur das gerenderte Mail-Objekt zurueckgeben -----
    if (dryRun) {
      const warnings: string[] = [];
      if (!emailContent || !emailContent.trim()) {
        warnings.push('Kein Anschreiben vorhanden — bitte zur Bearbeitung zurueck und Anschreiben erstellen oder generieren.');
      }
      if (!customerEmail) {
        warnings.push('Keine Empfaenger-E-Mail vorhanden.');
      }
      if (lexofficeQuotationId && !hasPdf) {
        warnings.push('LexOffice-PDF noch nicht verfuegbar — wird beim echten Versand erneut versucht.');
      }
      return new Response(
        JSON.stringify({
          success: true,
          warnings,
          preview: {
            from: fromAddress,
            to: finalTo,
            cc: finalCc,
            bcc: finalBcc,
            subject: finalSubject,
            htmlBody,
            attachment: {
              filename: attachmentFilename,
              available: hasPdf,
            },
            isReplyMode,
            inReplyTo: threadingHeaders['In-Reply-To'] || null,
            references: threadingHeaders['References'] || null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const result = await sendEmail(
      finalTo, finalSubject, htmlBody, fromName, pdfBuffer, customerName,
      finalBcc, replyToAddress, finalCc, threadingHeaders,
    );

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
      entity_type: 'v2_event',
      entity_id: event.id,
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

    // E-Mail in v2_event_emails speichern (Thread-Konversation)
    if (result.sent) {
      await supabase.from('v2_event_emails').insert({
        event_id: event.id,
        direction: 'outbound',
        from_email: 'info@events-storia.de',
        to_email: customerEmail,
        cc_email: finalCc.length > 0 ? finalCc.join(', ') : null,
        bcc_email: finalBcc.length > 0 ? finalBcc.join(', ') : null,
        subject: emailSubject,
        body_text: isReplyMode ? (emailContent || '') : cleanedEmailContent,
        body_html: htmlBody,
        attachments: hasPdf ? [{ filename: attachmentFilename }] : [],
        resend_message_id: result.messageId,
        resend_status: 'queued',
        in_reply_to: threadingHeaders['In-Reply-To'] || null,
        sent_at: new Date().toISOString(),
      } as Record<string, unknown>);
    }

    // Promote v2_event auf 'proposal_sent' (nur bei echtem Versand, nicht im Preview, nicht bei Reply)
    if (result.sent && !isTestPreview && !isReplyMode) {
      await supabase.from('v2_events').update({
        offer_sent_at: new Date().toISOString(),
        offer_sent_by: senderEmail || null,
        offer_phase: 'proposal_sent',
      } as Record<string, unknown>).eq('id', event.id);

      // Archiviere das tatsächlich versendete HTML in der höchsten History-Version
      // dieser Inquiry (vom Frontend kurz vorher angelegt). Damit zeigt die
      // Archiv-Detail-Ansicht (OfferArchivePreview) später 1:1 das Mail-HTML,
      // das der Kunde im Postfach gesehen hat — inkl. Logo, Header, Buttons.
      try {
        const { data: latestVersion } = await supabase
          .from('v2_event_offer_history')
          .select('id, version')
          .eq('event_id', event.id)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestVersion?.id) {
          const { error: histUpdErr } = await supabase
            .from('v2_event_offer_history')
            .update({ email_html: htmlBody } as Record<string, unknown>)
            .eq('id', latestVersion.id);
          if (histUpdErr) {
            console.error('[send-offer-email] email_html archive update failed:', histUpdErr);
          } else {
            console.log(`[send-offer-email] email_html archived for v${latestVersion.version}`);
          }
        } else {
          console.warn('[send-offer-email] No history row found to archive email_html');
        }
      } catch (e) {
        console.error('[send-offer-email] email_html archive exception (non-blocking):', e);
      }
    }

    // Activity Log
    await supabase.from('activity_logs').insert({
      entity_type: 'v2_event',
      entity_id: event.id,
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
        messageId: result.messageId,
        errorMessage: result.errorMessage,
        recipients: finalTo,
        cc: finalCc,
        bcc: finalBcc,
        subject: finalSubject,
        offerUrl,
        offerSlug: slug,
        hasPdfAttachment: hasPdf,
        warnings,
        isTestPreview: isTestPreview === true,
        isReplyMode,
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
