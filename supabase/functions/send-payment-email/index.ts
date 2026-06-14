import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';
import {
  resolveCustomerLanguage, emailLanguagePlan, bilingualSubject,
  type CustomerLang,
} from '../_shared/customer-language.ts';
import {
  formatCurrency, formatDate, paymentTypeLabel, t, SEPARATOR_HTML,
} from '../_shared/email-i18n.ts';
import { sendEmailWithFallback } from '../_shared/email-sender.ts';

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PAYMENT-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payment_id, is_reminder = false, is_confirmation = false } = await req.json();
    if (!payment_id) throw new Error('payment_id ist erforderlich');

    logStep("Sending payment email", { payment_id, is_reminder, is_confirmation });

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
    if (!is_confirmation && !payment.stripe_payment_link_url) {
      throw new Error('Kein Zahlungslink vorhanden — bitte erst Stripe Session erstellen');
    }
    if (!payment.customer_email) throw new Error('Keine E-Mail-Adresse bei der Anfrage hinterlegt');

    const { data: inquiryRow } = await supabase
      .from('event_inquiries')
      .select('is_test, customer_language')
      .eq('id', payment.inquiry_id)
      .single();
    const isTest = inquiryRow?.is_test === true;
    const safeEmail = getSafeRecipientEmail(payment.customer_email, isTest);

    const lang: CustomerLang = await resolveCustomerLanguage(supabase, payment.inquiry_id)
      .catch(() => 'de');
    // event_inquiries may have its own customer_language — prefer it when present.
    const inquiryLang = (inquiryRow?.customer_language as CustomerLang | undefined);
    const effectiveLang: CustomerLang =
      (inquiryLang && ['de', 'en', 'it', 'fr'].includes(inquiryLang)) ? inquiryLang : lang;
    const plan = emailLanguagePlan(effectiveLang);

    const subjectFor = (lng: CustomerLang) => {
      const typeLbl = paymentTypeLabel(lng, payment.payment_type);
      const amt = formatCurrency(lng, payment.amount_cents);
      const ev = payment.preferred_date
        ? formatDate(lng, payment.preferred_date)
        : ({ de: 'Termin offen', en: 'date TBC', it: 'data da definire', fr: 'date à définir' }[lng]);
      if (is_confirmation) {
        return ({
          de: `Zahlungseingang bestätigt: ${typeLbl} für Ihre Veranstaltung am ${ev}`,
          en: `Payment received: ${typeLbl} for your event on ${ev}`,
          it: `Pagamento ricevuto: ${typeLbl} per il vostro evento del ${ev}`,
          fr: `Paiement reçu : ${typeLbl} pour votre événement du ${ev}`,
        }[lng]);
      }
      if (is_reminder) {
        return ({
          de: `Erinnerung: ${typeLbl} für Ihre Veranstaltung am ${ev}`,
          en: `Reminder: ${typeLbl} for your event on ${ev}`,
          it: `Promemoria: ${typeLbl} per il vostro evento del ${ev}`,
          fr: `Rappel : ${typeLbl} pour votre événement du ${ev}`,
        }[lng]);
      }
      return ({
        de: `${typeLbl}: ${amt} für Ihre Veranstaltung am ${ev}`,
        en: `${typeLbl}: ${amt} for your event on ${ev}`,
        it: `${typeLbl}: ${amt} per il vostro evento del ${ev}`,
        fr: `${typeLbl} : ${amt} pour votre événement du ${ev}`,
      }[lng]);
    };

    const subjects: Record<CustomerLang, string> = {
      de: subjectFor('de'), en: subjectFor('en'), it: subjectFor('it'), fr: subjectFor('fr'),
    };
    const subject = bilingualSubject(effectiveLang, subjects);

    const buildBlock = (lng: CustomerLang) => {
      const typeLbl = paymentTypeLabel(lng, payment.payment_type);
      const amt = formatCurrency(lng, payment.amount_cents);
      const dueStr = payment.effective_due_date ? formatDate(lng, payment.effective_due_date) : null;

      const introMap = {
        de: is_confirmation
          ? `vielen Dank! Wir haben Ihre <strong>${typeLbl}</strong> in Höhe von <strong>${amt}</strong> erhalten und Ihre Buchung ist damit verbindlich bestätigt. Die offizielle Rechnung erhalten Sie separat per E-Mail.`
          : is_reminder
            ? `wir möchten Sie freundlich daran erinnern, dass Ihre <strong>${typeLbl}</strong> in Höhe von <strong>${amt}</strong>${dueStr ? ` (fällig seit ${dueStr})` : ''} noch aussteht.`
            : `anbei erhalten Sie den Zahlungslink für die <strong>${typeLbl}</strong> in Höhe von <strong>${amt}</strong>${dueStr ? ` (fällig bis ${dueStr})` : ''}.`,
        en: is_confirmation
          ? `thank you! We have received your <strong>${typeLbl}</strong> of <strong>${amt}</strong> and your booking is now confirmed. The official invoice will follow by email.`
          : is_reminder
            ? `a friendly reminder that your <strong>${typeLbl}</strong> of <strong>${amt}</strong>${dueStr ? ` (due since ${dueStr})` : ''} is still pending.`
            : `please find below the payment link for your <strong>${typeLbl}</strong> of <strong>${amt}</strong>${dueStr ? ` (due by ${dueStr})` : ''}.`,
        it: is_confirmation
          ? `grazie! Abbiamo ricevuto il vostro <strong>${typeLbl}</strong> di <strong>${amt}</strong> e la prenotazione è ora confermata. La fattura ufficiale seguirà via e-mail.`
          : is_reminder
            ? `un cortese promemoria: il vostro <strong>${typeLbl}</strong> di <strong>${amt}</strong>${dueStr ? ` (scaduto dal ${dueStr})` : ''} è ancora in sospeso.`
            : `di seguito trovate il link di pagamento per il <strong>${typeLbl}</strong> di <strong>${amt}</strong>${dueStr ? ` (entro il ${dueStr})` : ''}.`,
        fr: is_confirmation
          ? `merci ! Nous avons bien reçu votre <strong>${typeLbl}</strong> de <strong>${amt}</strong> et votre réservation est confirmée. La facture officielle suivra par e-mail.`
          : is_reminder
            ? `un rappel : votre <strong>${typeLbl}</strong> de <strong>${amt}</strong>${dueStr ? ` (échue depuis le ${dueStr})` : ''} reste en attente.`
            : `veuillez trouver ci-dessous le lien de paiement pour le <strong>${typeLbl}</strong> de <strong>${amt}</strong>${dueStr ? ` (avant le ${dueStr})` : ''}.`,
      } as const;

      const heading = is_confirmation
        ? ({ de: 'Zahlung erhalten – Vielen Dank!', en: 'Payment received – Thank you!', it: 'Pagamento ricevuto – Grazie!', fr: 'Paiement reçu – Merci !' }[lng])
        : `${typeLbl}: ${amt}`;

      const ctaHtml = is_confirmation ? '' : `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr><td>
          <a href="${payment.stripe_payment_link_url || ''}"
             style="display:inline-block;background-color:#b45309;color:#ffffff;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;">
            ${t(lng, 'payNowCta')}
          </a>
        </td></tr>
      </table>
      <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 8px;">${t(lng, 'paymentLinkValidity')}</p>`;

      return `
        <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">${heading}</h2>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">${t(lng, 'greeting')} ${payment.contact_name || ''},</p>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 24px;">${introMap[lng]}</p>
        ${ctaHtml}
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
          <strong>${t(lng, 'cancellationTermsTitle')}</strong><br/>
          ${t(lng, 'cancellationTermsBody')}<br/>
          <span style="font-size:13px;color:#666666;">${t(lng, 'cancellationTermsFootnote')}
            <a href="https://www.events-storia.de/agb-veranstaltungen" style="color:#b45309;">events-storia.de/agb-veranstaltungen</a>
          </span>
        </p>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:24px 0 0;">
          ${t(lng, 'questionsLine')}<br/>
          <a href="tel:+498951519696" style="color:#b45309;text-decoration:none;">089 51519696</a>
          – <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none;">info@events-storia.de</a>
        </p>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
          ${t(lng, 'signOff')}<br/><strong>${t(lng, 'teamSignature')}</strong>
        </p>`;
    };

    const primaryBlock = buildBlock(plan.primary);
    const secondaryBlock = plan.secondary ? `${SEPARATOR_HTML}${buildBlock(plan.secondary)}` : '';
    const footerLang = plan.primary;

    const html = `<!DOCTYPE html>
<html lang="${plan.primary}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background-color:#1a1a1a;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif;">STORIA Events</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          ${primaryBlock}
          ${secondaryBlock}
        </td></tr>
        <tr><td style="background-color:#f5f5f0;padding:20px 32px;font-size:11px;color:#777777;border-top:1px solid #e5e5e5;">
          <p style="margin:0 0 8px;">${t(footerLang, 'legalDisclaimer')}</p>
          <p style="margin:0 0 8px;">
            <a href="https://events-storia.de/datenschutz" style="color:#b45309;">${t(footerLang, 'privacyImprint')}</a> ·
            <a href="https://events-storia.de/impressum" style="color:#b45309;margin-left:8px;">${t(footerLang, 'imprint')}</a>
          </p>
          <p style="margin:0;">Speranza GmbH · Karlstraße 47a · 80333 München · info@events-storia.de · +49 89 51519696</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const safeSubject = getSafeSubject(subject, isTest);
    logStep("Sending (Resend primary, SMTP fallback)", { to: safeEmail, subject: safeSubject, lang: effectiveLang });

    const sendResult = await sendEmailWithFallback({
      to: safeEmail,
      bcc: 'info@events-storia.de',
      subject: safeSubject,
      html,
    });
    if (!sendResult.success) {
      throw new Error(`Versand fehlgeschlagen — Resend: ${sendResult.resendError}; SMTP: ${sendResult.smtpError}`);
    }
    logStep("Email sent", { messageId: sendResult.messageId, provider: sendResult.provider });

    const updateField = is_reminder ? 'reminder_sent_at' : 'email_sent_at';
    await supabase
      .from('event_payments')
      .update({
        [updateField]: new Date().toISOString(),
        email_resend_id: sendResult.messageId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    return new Response(
      JSON.stringify({ success: true, messageId: sendResult.messageId, provider: sendResult.provider, language: effectiveLang }),
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
