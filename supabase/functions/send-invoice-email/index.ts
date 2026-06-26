import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSafeRecipientEmail } from '../_shared/test-safety.ts';
import {
  resolveCustomerLanguage, emailLanguagePlan, bilingualSubject,
  type CustomerLang,
} from '../_shared/customer-language.ts';
import { SEPARATOR_HTML, t, formatDateLong } from '../_shared/email-i18n.ts';
import { sendEmailWithFallback } from '../_shared/email-sender.ts';
import { getTenantConfig, tenantSender } from '../_shared/tenant.ts';

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-INVOICE-EMAIL] ${step}${d}`);
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

interface RequestBody {
  inquiry_id: string;
  recipient_email?: string;
  language?: CustomerLang;
  extra_note?: string;
  /** If true: render only, do not actually send (preview). */
  dry_run?: boolean;
  sender_email?: string;
}

const CHROME: Record<CustomerLang, {
  subject: string;
  greetingFallback: string;
  intro: (num: string | null) => string;
  attached: string;
  details: string;
  date: string;
  guests: string;
  total: string;
  thanks: string;
  questions: string;
}> = {
  de: {
    subject: 'Ihre Rechnung von STORIA Events',
    greetingFallback: 'Guten Tag',
    intro: (n) => n
      ? `anbei senden wir Ihnen die Rechnung <strong>${escapeHtml(n)}</strong> zu Ihrer Buchung.`
      : 'anbei senden wir Ihnen die Rechnung zu Ihrer Buchung.',
    attached: 'Die Rechnung finden Sie als PDF im Anhang dieser E-Mail.',
    details: 'Eventdetails',
    date: 'Datum',
    guests: 'Gäste',
    total: 'Gesamtbetrag',
    thanks: 'Vielen Dank für Ihr Vertrauen!',
    questions: 'Bei Fragen zur Rechnung stehen wir Ihnen jederzeit gerne zur Verfügung.',
  },
  en: {
    subject: 'Your invoice from STORIA Events',
    greetingFallback: 'Hello',
    intro: (n) => n
      ? `please find attached invoice <strong>${escapeHtml(n)}</strong> for your booking.`
      : 'please find attached the invoice for your booking.',
    attached: 'The invoice is attached as a PDF to this email.',
    details: 'Event details',
    date: 'Date',
    guests: 'Guests',
    total: 'Total amount',
    thanks: 'Thank you for your trust!',
    questions: 'If you have any questions about the invoice, we are happy to help.',
  },
  it: {
    subject: 'La vostra fattura di STORIA Events',
    greetingFallback: 'Buongiorno',
    intro: (n) => n
      ? `in allegato la fattura <strong>${escapeHtml(n)}</strong> per la vostra prenotazione.`
      : 'in allegato la fattura per la vostra prenotazione.',
    attached: 'La fattura è allegata come PDF a questa email.',
    details: 'Dettagli evento',
    date: 'Data',
    guests: 'Ospiti',
    total: 'Importo totale',
    thanks: 'Grazie per la vostra fiducia!',
    questions: 'Per qualsiasi domanda sulla fattura, siamo a vostra disposizione.',
  },
  fr: {
    subject: 'Votre facture STORIA Events',
    greetingFallback: 'Bonjour',
    intro: (n) => n
      ? `veuillez trouver ci-joint la facture <strong>${escapeHtml(n)}</strong> pour votre réservation.`
      : 'veuillez trouver ci-joint la facture pour votre réservation.',
    attached: 'La facture est jointe en PDF à cet email.',
    details: 'Détails de l\u2019événement',
    date: 'Date',
    guests: 'Invités',
    total: 'Montant total',
    thanks: 'Merci pour votre confiance !',
    questions: 'Pour toute question concernant la facture, nous restons à votre disposition.',
  },
};

function renderBlock(lang: CustomerLang, args: {
  contactName: string | null;
  invoiceNumber: string | null;
  eventDate: string | null;
  guestCount: number | null;
  totalEuro: number | null;
  extraNote: string | null;
}): string {
  const c = CHROME[lang];
  const greeting = args.contactName
    ? `${t(lang, 'greeting')} ${escapeHtml(args.contactName)},`
    : `${c.greetingFallback},`;

  const detailsRows: string[] = [];
  if (args.eventDate) {
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${c.date}</td><td style="padding:4px 0;color:#222;">${escapeHtml(formatDateLong(lang, args.eventDate))}</td></tr>`);
  }
  if (args.guestCount) {
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${c.guests}</td><td style="padding:4px 0;color:#222;">${args.guestCount}</td></tr>`);
  }
  if (typeof args.totalEuro === 'number' && args.totalEuro > 0) {
    const fmt = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : (lang === 'fr' ? 'fr-FR' : (lang === 'it' ? 'it-IT' : 'en-GB')), { style: 'currency', currency: 'EUR' }).format(args.totalEuro);
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">${c.total}</td><td style="padding:4px 0;color:#222;font-weight:600;">${escapeHtml(fmt)}</td></tr>`);
  }

  const detailsBlock = detailsRows.length > 0
    ? `<div style="margin:20px 0;padding:14px 16px;background:#faf8f5;border-radius:12px;">
         <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">${c.details}</div>
         <table style="width:100%;font-size:14px;border-collapse:collapse;">${detailsRows.join('')}</table>
       </div>`
    : '';

  const extra = args.extraNote && args.extraNote.trim().length > 0
    ? `<p style="font-size:15px;color:#333;line-height:1.55;margin:16px 0;white-space:pre-wrap;">${escapeHtml(args.extraNote.trim())}</p>`
    : '';

  return `
    <p style="font-size:15px;color:#333;line-height:1.55;margin:0 0 14px;">${greeting}</p>
    <p style="font-size:15px;color:#333;line-height:1.55;margin:0 0 14px;">${c.intro(args.invoiceNumber)}</p>
    <p style="font-size:15px;color:#333;line-height:1.55;margin:0 0 14px;">${c.attached}</p>
    ${detailsBlock}
    ${extra}
    <p style="font-size:15px;color:#333;line-height:1.55;margin:16px 0 6px;">${c.thanks}</p>
    <p style="font-size:14px;color:#666;line-height:1.55;margin:0 0 18px;">${c.questions}</p>
  `;
}

export interface EmailSenderInfo {
  name: string;
  addressLine: string;
  email: string;
  websiteUrl: string;
  websiteLabel: string;
}

/** Storia-Default — identisch mit dem bisherigen Hardcode (NON-BREAKING). */
const STORIA_SENDER: EmailSenderInfo = {
  name: 'STORIA Events',
  addressLine: 'Karlstraße 47a, 80333 München',
  email: 'info@events-storia.de',
  websiteUrl: 'https://events-storia.de',
  websiteLabel: 'events-storia.de',
};

export function buildInvoiceEmailHtml(
  lang: CustomerLang,
  args: {
    contactName: string | null;
    invoiceNumber: string | null;
    eventDate: string | null;
    guestCount: number | null;
    totalEuro: number | null;
    extraNote: string | null;
  },
  sender: EmailSenderInfo = STORIA_SENDER,
): string {
  const plan = emailLanguagePlan(lang);
  const primary = renderBlock(plan.primary, args);
  const secondary = plan.secondary ? renderBlock(plan.secondary, args) : '';
  const sig = `
    <div style="margin-top:24px;padding-top:18px;border-top:1px solid #ececec;font-size:13px;color:#777;line-height:1.5;">
      ${escapeHtml(sender.name)} &middot; ${escapeHtml(sender.addressLine)}<br/>
      <a href="mailto:${escapeHtml(sender.email)}" style="color:#777;">${escapeHtml(sender.email)}</a> &middot;
      <a href="${escapeHtml(sender.websiteUrl)}" style="color:#777;">${escapeHtml(sender.websiteLabel)}</a>
    </div>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 28px;">
      ${primary}
      ${plan.secondary ? SEPARATOR_HTML + secondary : ''}
      ${sig}
    </div>
  </body></html>`;
}

/** Fetch the invoice PDF from LexOffice (2-step: /invoices/:id/document → /files/:id). */
async function fetchInvoicePdf(invoiceId: string, apiKey: string): Promise<Uint8Array | null> {
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1500 * i));
    try {
      const docRes = await fetch(`https://api.lexoffice.io/v1/invoices/${invoiceId}/document`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      if (docRes.status === 406) { log('PDF not ready', { attempt: i + 1 }); continue; }
      if (!docRes.ok) { log('document endpoint failed', { status: docRes.status }); continue; }
      const docData = await docRes.json();
      const fileId = docData?.documentFileId;
      if (!fileId) continue;
      const fileRes = await fetch(`https://api.lexoffice.io/v1/files/${fileId}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/pdf' },
      });
      if (!fileRes.ok) { log('file endpoint failed', { status: fileRes.status }); continue; }
      const buf = await fileRes.arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      log('PDF fetch exception', { attempt: i + 1, err: String(e) });
    }
  }
  return null;
}

function pdfToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as RequestBody;
    if (!body?.inquiry_id) throw new Error('inquiry_id ist erforderlich');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: inquiry, error: invErr } = await supabase
      .from('v2_events')
      .select('id, tenant_id, customer_id, company_name, customer_language, date, guest_count, amount_total, invoice_lexoffice_id, invoice_lexoffice_number, final_lexoffice_invoice_id, final_lexoffice_invoice_number, is_test, customer:v2_customers!v2_events_customer_id_fkey(email, name, company)')
      .eq('id', body.inquiry_id)
      .single();
    if (invErr || !inquiry) {
      log('inquiry fetch failed', { err: invErr?.message, inquiry_id: body.inquiry_id });
      throw new Error(`Anfrage nicht gefunden: ${invErr?.message || 'no row'}`);
    }

    const customer = (inquiry as any).customer || {};
    const contactName: string | null = customer.name || null;
    const customerEmail: string | null = customer.email || null;

    const lexofficeInvoiceId: string | null =
      (inquiry as any).final_lexoffice_invoice_id || (inquiry as any).invoice_lexoffice_id || null;
    const invoiceNumber: string | null =
      (inquiry as any).final_lexoffice_invoice_number || (inquiry as any).invoice_lexoffice_number || null;

    if (!lexofficeInvoiceId) throw new Error('Keine LexOffice-Rechnung mit dieser Buchung verknüpft');

    const recipient = body.recipient_email?.trim() || customerEmail;
    if (!recipient) throw new Error('Keine Empfänger-Adresse vorhanden');

    const dbLang = await resolveCustomerLanguage(supabase, body.inquiry_id).catch(() => 'de' as CustomerLang);
    const requested = (body.language as CustomerLang | undefined);
    const lang: CustomerLang = (requested && ['de','en','it','fr'].includes(requested)) ? requested : dbLang;
    const plan = emailLanguagePlan(lang);

    const subject = bilingualSubject(lang, {
      de: CHROME.de.subject, en: CHROME.en.subject, it: CHROME.it.subject, fr: CHROME.fr.subject,
    });

    const amountTotal = (inquiry as any).amount_total;
    const totalEuro = amountTotal != null ? Number(amountTotal) : null;

    // Mandanten-Konfiguration (Phase 4b) — Absender/Signatur/NAP aus tenants.
    // Fallback: Storia → für den Default-Tenant byte-identisch zum Hardcode.
    const tenantCfg = await getTenantConfig(supabase, (inquiry as any).tenant_id);
    const sender = tenantSender(tenantCfg);
    const senderInfo = {
      name: tenantCfg.emailFromName,
      addressLine: [
        tenantCfg.addressStreet,
        [tenantCfg.addressZip, tenantCfg.addressCity].filter(Boolean).join(' '),
      ].filter(Boolean).join(', '),
      email: tenantCfg.fromEmail,
      websiteUrl: tenantCfg.website ?? 'https://events-storia.de',
      websiteLabel: (tenantCfg.website ?? 'https://events-storia.de').replace(/^https?:\/\//, ''),
    };

    const html = buildInvoiceEmailHtml(lang, {
      contactName,
      invoiceNumber,
      eventDate: (inquiry as any).date || null,
      guestCount: (inquiry as any).guest_count || null,
      totalEuro,
      extraNote: body.extra_note || null,
    }, senderInfo);

    if (body.dry_run) {
      return new Response(JSON.stringify({
        success: true, dry_run: true, subject, html, recipient,
        invoice_number: invoiceNumber, language: lang, has_secondary: !!plan.secondary,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch PDF
    const apiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!apiKey) throw new Error('LEXOFFICE_API_KEY nicht konfiguriert');
    log('fetching invoice PDF', { lexofficeInvoiceId });
    const pdf = await fetchInvoicePdf(lexofficeInvoiceId, apiKey);
    if (!pdf) throw new Error('Rechnungs-PDF konnte nicht von LexOffice geladen werden');

    const isTest = (inquiry as any).is_test === true;
    const safeRecipient = getSafeRecipientEmail(recipient, isTest);
    const filename = `STORIA_Rechnung_${(invoiceNumber || lexofficeInvoiceId).replace(/[^a-zA-Z0-9_.-]/g, '_')}.pdf`;
    const archiveBcc = tenantCfg.fromEmail;
    const pdfB64 = pdfToBase64(pdf);
    const sendResult = await sendEmailWithFallback({
      from: sender.from,
      replyTo: sender.replyTo,
      to: safeRecipient,
      bcc: archiveBcc,
      subject,
      html,
      attachments: [{ filename, contentBase64: pdfB64, contentType: 'application/pdf' }],
    });
    if (!sendResult.success) {
      log('Both Resend and SMTP failed', {
        resendError: sendResult.resendError,
        smtpError: sendResult.smtpError,
      });
      throw new Error(
        `Versand fehlgeschlagen — Resend: ${sendResult.resendError}; SMTP: ${sendResult.smtpError}`,
      );
    }
    const messageId: string | null = sendResult.messageId;
    log('Email sent', { messageId, provider: sendResult.provider, recipient: safeRecipient });

    // Mark inquiry
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || '',
    ).catch(() => ({ data: { user: null } } as { data: { user: null } }));

    await supabase.from('v2_events').update({
      invoice_email_sent_at: new Date().toISOString(),
      invoice_email_sent_by: user?.id || null,
    } as Record<string, unknown>).eq('id', body.inquiry_id);

    // Archive in v2_event_emails (non-blocking)
    await supabase.from('v2_event_emails').insert({
      event_id: body.inquiry_id,
      direction: 'outbound',
      from_email: tenantCfg.fromEmail,
      to_email: safeRecipient,
      bcc_email: archiveBcc,
      subject,
      body_html: html,
      attachments: [{ filename }],
      resend_message_id: messageId,
      resend_status: sendResult.provider === 'resend' ? 'queued' : 'sent_via_smtp_fallback',
      sent_at: new Date().toISOString(),
    } as Record<string, unknown>).then(({ error }) => {
      if (error) console.warn('[send-invoice-email] email archive failed:', error.message);
    });

    // Activity log (non-blocking)
    await supabase.from('activity_logs').insert({
      entity_type: 'v2_event',
      entity_id: body.inquiry_id,
      action: 'invoice_email_sent',
      actor_email: body.sender_email || user?.email || 'system',
      metadata: {
        recipient: safeRecipient,
        invoice_number: invoiceNumber,
        lexoffice_invoice_id: lexofficeInvoiceId,
        language: lang,
        resend_message_id: messageId,
        provider: sendResult.provider,
        resend_error: sendResult.resendError ?? null,
      },
    }).then(({ error }) => {
      if (error) console.warn('[send-invoice-email] activity log failed:', error.message);
    });

    return new Response(JSON.stringify({
      success: true,
      messageId,
      provider: sendResult.provider,
      recipient: safeRecipient,
      subject,
      invoice_number: invoiceNumber,
      language: lang,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    console.error('[send-invoice-email] error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});