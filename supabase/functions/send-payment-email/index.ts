import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PAYMENT-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, is_reminder = false } = await req.json();
    if (!payment_id) throw new Error('payment_id ist erforderlich');

    logStep("Sending payment email", { payment_id, is_reminder });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: payment, error } = await supabase
      .from('event_payments_enriched')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (error || !payment) throw new Error('Zahlung nicht gefunden');
    if (!payment.stripe_payment_link_url) throw new Error('Kein Zahlungslink vorhanden — bitte erst Stripe Session erstellen');
    if (!payment.customer_email) throw new Error('Keine E-Mail-Adresse bei der Anfrage hinterlegt');

    // Check if the linked inquiry is a test
    const { data: inquiryRow } = await supabase
      .from('event_inquiries')
      .select('is_test')
      .eq('id', payment.inquiry_id)
      .single();
    const isTest = inquiryRow?.is_test === true;
    const safeEmail = getSafeRecipientEmail(payment.customer_email, isTest);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY nicht konfiguriert');

    const typeLabels: Record<string, string> = {
      deposit: 'Anzahlung',
      prepayment: 'Vorauszahlung',
      final: 'Endabrechnung',
    };
    const typeLabel = typeLabels[payment.payment_type] || payment.payment_type;

    const amountFormatted = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(payment.amount_cents / 100);

    const eventDateStr = payment.preferred_date
      ? new Date(payment.preferred_date).toLocaleDateString('de-DE')
      : 'Termin offen';

    const effectiveDueDateStr = payment.effective_due_date
      ? new Date(payment.effective_due_date).toLocaleDateString('de-DE')
      : null;

    const subject = is_reminder
      ? `Erinnerung: ${typeLabel} für ${payment.event_type || 'Ihre Veranstaltung'} am ${eventDateStr}`
      : `${typeLabel}: ${amountFormatted} für Ihre Veranstaltung am ${eventDateStr}`;

    const introText = is_reminder
      ? `wir möchten Sie freundlich daran erinnern, dass Ihre <strong>${typeLabel}</strong> in Höhe von <strong>${amountFormatted}</strong>${effectiveDueDateStr ? ` (fällig seit ${effectiveDueDateStr})` : ''} noch aussteht.`
      : `anbei erhalten Sie den Zahlungslink für die <strong>${typeLabel}</strong> in Höhe von <strong>${amountFormatted}</strong>${effectiveDueDateStr ? ` (fällig bis ${effectiveDueDateStr})` : ''}.`;

    const html = buildPaymentEmailHtml({
      customerName: payment.contact_name,
      introText,
      typeLabel,
      amountFormatted,
      paymentUrl: payment.stripe_payment_link_url,
    });

    const safeSubject = getSafeSubject(subject, isTest);
    logStep("Sending via Resend", { to: safeEmail, subject: safeSubject });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'STORIA Events <info@events-storia.de>',
        to: [safeEmail],
        bcc: ['info@events-storia.de'],
        subject: safeSubject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      throw new Error(`Resend Fehler (${resendResponse.status}): ${errText}`);
    }

    const resendResult = await resendResponse.json();
    logStep("Email sent", { messageId: resendResult.id });

    // Timestamp auf Payment setzen
    const updateField = is_reminder ? 'reminder_sent_at' : 'email_sent_at';
    await supabase
      .from('event_payments')
      .update({
        [updateField]: new Date().toISOString(),
        email_resend_id: resendResult.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    return new Response(
      JSON.stringify({ success: true, messageId: resendResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    logStep("ERROR", { error: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function buildPaymentEmailHtml(opts: {
  customerName: string;
  introText: string;
  typeLabel: string;
  amountFormatted: string;
  paymentUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background-color:#1a1a1a;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif;">STORIA Events</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">${opts.typeLabel}: ${opts.amountFormatted}</h2>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Guten Tag ${opts.customerName},
          </p>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 24px;">
            ${opts.introText}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td>
              <a href="${opts.paymentUrl}"
                 style="display:inline-block;background-color:#b45309;color:#ffffff;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;">
                Jetzt bezahlen →
              </a>
            </td></tr>
          </table>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Sie können per Kreditkarte, SEPA-Lastschrift oder – bei Firmenbuchungen – auf Rechnung über Billie bezahlen.
            Der Zahlungslink ist 72 Stunden gültig.
          </p>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
            <strong>Stornobedingungen:</strong><br/>
            Bis 30 Tage vorher: kostenlos &middot;
            14–30 Tage: 25&nbsp;% &middot;
            7–14 Tage: 50&nbsp;% &middot;
            2–7 Tage: 80&nbsp;% &middot;
            Unter 48&nbsp;Std./No-Show: 100&nbsp;% abzgl. ersparter Aufwendungen.<br/>
            <span style="font-size:13px;color:#666666;">
              Es steht Ihnen frei nachzuweisen, dass ein geringerer oder kein Schaden entstanden ist (§&nbsp;309 Nr.&nbsp;5b BGB).
              Vollständige AGB:
              <a href="https://www.events-storia.de/agb-veranstaltungen" style="color:#b45309;">events-storia.de/agb-veranstaltungen</a>
            </span>
          </p>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:24px 0 0;">
            Bei Fragen stehen wir Ihnen gerne zur Verfügung:<br/>
            <a href="tel:+498995457475" style="color:#b45309;text-decoration:none;">089 954 574 750</a>
            oder <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none;">info@events-storia.de</a>
          </p>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
            Herzliche Grüße,<br/>
            <strong>Ihr STORIA Events Team</strong>
          </p>
        </td></tr>
        <tr><td style="background-color:#f5f5f0;padding:20px 32px;font-size:11px;color:#777777;border-top:1px solid #e5e5e5;">
          <p style="margin:0 0 8px;">
            <strong>Rechtliche Hinweise:</strong>
            Mit der Zahlung bestätigen Sie die Buchung zu den vereinbarten Konditionen.
            Es gelten unsere <a href="https://events-storia.de/agb-veranstaltungen" style="color:#b45309;">AGB für Veranstaltungen</a>.
            Da es sich um eine Dienstleistung zu einem spezifischen Termin handelt, besteht kein Widerrufsrecht
            (§ 312g Abs. 2 Nr. 9 BGB). Es gelten die Stornobedingungen gemäß AGB.
          </p>
          <p style="margin:0 0 8px;">
            <a href="https://events-storia.de/datenschutz" style="color:#b45309;">Datenschutzerklärung</a> ·
            <a href="https://events-storia.de/impressum" style="color:#b45309;margin-left:8px;">Impressum</a>
          </p>
          <p style="margin:0;">
            Dream &amp; Anchor Handelsgesellschaft mbH · Karlstraße 47a · 80333 München ·
            info@events-storia.de · +49 89 954 574 750
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
