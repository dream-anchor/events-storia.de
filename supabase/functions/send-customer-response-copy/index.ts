import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { resolveV2Event } from '../_shared/v2-lookup.ts';
import { resolveCustomerLanguage, emailLanguagePlan, bilingualSubject, type CustomerLang } from '../_shared/customer-language.ts';
import { SEPARATOR_TEXT } from '../_shared/email-i18n.ts';

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
  let sent = false, provider = "", messageId: string | null = null, errorMessage: string | null = null;

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          from: `${fromName} <info@events-storia.de>`,
          to, subject, html, reply_to: 'info@events-storia.de',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        sent = true; provider = "resend"; messageId = data.id || null;
      } else { errorMessage = `Resend error: ${await res.text()}`; console.error(errorMessage); }
    } catch (err) { errorMessage = err instanceof Error ? err.message : "Resend error"; }
  }

  if (!sent && smtpUser && smtpPassword) {
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const client = new SMTPClient({
        connection: {
          hostname: Deno.env.get("SMTP_HOST") || "smtp.ionos.de",
          port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
          tls: true, auth: { username: smtpUser, password: smtpPassword },
        },
      });
      await client.send({ from: `${fromName} <${smtpUser}>`, to, subject, html });
      await client.close();
      sent = true; provider = "ionos_smtp"; errorMessage = null;
    } catch (smtpErr) { errorMessage = smtpErr instanceof Error ? smtpErr.message : "SMTP error"; }
  }

  if (!sent && !resendApiKey && !smtpUser) errorMessage = "No email provider configured";
  return { sent, provider, messageId, errorMessage };
}

const SERVICE_LABELS = {
  de: { booked: 'Gebuchte Leistungen:', equipment: 'Ausstattung', staff: 'Personal' },
  en: { booked: 'Booked services:', equipment: 'Equipment', staff: 'Staff' },
  it: { booked: 'Servizi prenotati:', equipment: 'Attrezzatura', staff: 'Personale' },
  fr: { booked: 'Prestations réservées :', equipment: 'Équipement', staff: 'Personnel' },
} as const;

function buildBlock(lng: CustomerLang, args: {
  selectedOptionLabel: string;
  serviceDetails: string;
  customerNotes: string | null;
}): string {
  const headings = {
    de: 'Vielen Dank für Ihre Rückmeldung!',
    en: 'Thank you for your response!',
    it: 'Grazie per la vostra risposta!',
    fr: 'Merci pour votre réponse !',
  } as const;
  const youSelected = {
    de: 'Sie haben folgenden Vorschlag ausgewählt:',
    en: 'You selected the following proposal:',
    it: 'Avete selezionato la seguente proposta:',
    fr: 'Vous avez sélectionné la proposition suivante :',
  } as const;
  const notesLabel = {
    de: 'Ihre Anmerkungen:',
    en: 'Your notes:',
    it: 'Le vostre note:',
    fr: 'Vos remarques :',
  } as const;
  const closing = {
    de: 'Wir melden uns in Kürze mit dem finalen Angebot bei Ihnen.',
    en: 'We will get back to you shortly with the final offer.',
    it: 'Vi contatteremo a breve con l\'offerta finale.',
    fr: 'Nous reviendrons vers vous prochainement avec l\'offre finale.',
  } as const;
  const questions = {
    de: 'Bei Fragen erreichen Sie uns jederzeit:',
    en: 'For any questions, you can reach us at any time:',
    it: 'Per qualsiasi domanda, potete contattarci in qualsiasi momento:',
    fr: 'Pour toute question, vous pouvez nous contacter à tout moment :',
  } as const;

  return `${headings[lng]}

${youSelected[lng]}
${args.selectedOptionLabel}
${args.serviceDetails}
${args.customerNotes ? `\n${notesLabel[lng]}\n${args.customerNotes}\n` : '\n'}${closing[lng]}

${questions[lng]}
Domenico Speranza – 0163 6033912
Madina Khader – 0179 2200921`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { inquiryId, customerEmail, selectedOptionLabel, customerNotes } =
      await req.json() as ResponseCopyRequest;

    if (!customerEmail || !inquiryId) throw new Error('customerEmail and inquiryId are required');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const event = await resolveV2Event(supabase, inquiryId);
    const eventId = event?.id || null;
    const lang: CustomerLang = (['de','en','it','fr'] as string[]).includes(event?.customer_language)
      ? event!.customer_language as CustomerLang
      : await resolveCustomerLanguage(supabase, eventId || inquiryId).catch(() => 'de' as CustomerLang);
    const plan = emailLanguagePlan(lang);

    const SL = SERVICE_LABELS;
    let serviceDetails = '';
    {
      const { data: selectedOpt } = await supabase
        .from('inquiry_offer_options')
        .select('menu_selection')
        .eq('inquiry_id', inquiryId)
        .eq('option_label', selectedOptionLabel)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      const ms = selectedOpt?.menu_selection as any;
      const equip = (ms?.equipment || []).filter((e: any) => e.name && e.pricePerUnit > 0 && e.quantity > 0);
      const staff = (ms?.staff || []).filter((e: any) => e.name && e.pricePerUnit > 0 && e.quantity > 0);
      if (equip.length > 0 || staff.length > 0) {
        const lp = SL[plan.primary];
        const lines: string[] = [`\n${lp.booked}`];
        for (const e of equip) lines.push(`  ${lp.equipment}: ${e.name} (${e.quantity}x)`);
        for (const e of staff) lines.push(`  ${lp.staff}: ${e.name} (${e.quantity}x)`);
        serviceDetails = lines.join('\n');
      }
    }

    const subjectFor = (lng: CustomerLang) => ({
      de: 'Ihre Rückmeldung zum STORIA-Angebot',
      en: 'Your response to the STORIA offer',
      it: 'La vostra risposta all\'offerta STORIA',
      fr: 'Votre réponse à l\'offre STORIA',
    }[lng]);
    const emailSubject = bilingualSubject(lang, {
      de: subjectFor('de'), en: subjectFor('en'), it: subjectFor('it'), fr: subjectFor('fr'),
    });

    const primaryBlock = buildBlock(plan.primary, { selectedOptionLabel, serviceDetails, customerNotes });
    const secondaryBlock = plan.secondary
      ? buildBlock(plan.secondary, { selectedOptionLabel, serviceDetails, customerNotes })
      : '';
    const FOOTER = `\n\nSTORIA · Catering & Events\nKarlstraße 47a\n80333 München\nTel: +49 89 51519696\ninfo@events-storia.de`;
    const emailBody = secondaryBlock
      ? `${primaryBlock}${SEPARATOR_TEXT}${secondaryBlock}${FOOTER}`
      : `${primaryBlock}${FOOTER}`;

    const htmlBody = `<!DOCTYPE html>
<html lang="${plan.primary}"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailBody}</div>
</body></html>`;

    const result = await sendEmail([customerEmail], emailSubject, htmlBody, "STORIA Events");

    await supabase.from('email_delivery_logs').insert({
      entity_type: eventId ? 'v2_event' : 'unknown',
      entity_id: eventId || inquiryId,
      recipient_email: customerEmail,
      subject: emailSubject,
      provider: result.provider || 'none',
      provider_message_id: result.messageId,
      status: result.sent ? 'sent' : 'failed',
      error_message: result.errorMessage,
      sent_by: 'system',
      metadata: { email_type: 'customer_response_copy', selectedOptionLabel, language: lang },
    });

    if (result.sent && eventId) {
      await supabase.from('v2_event_emails').insert({
        event_id: eventId, direction: 'outbound',
        from_email: 'info@events-storia.de', to_email: customerEmail,
        subject: emailSubject, body_text: emailBody, body_html: htmlBody,
        resend_message_id: result.messageId, resend_status: 'queued',
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: result.sent, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
