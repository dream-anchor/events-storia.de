import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';
import { resolveV2Event } from '../_shared/v2-lookup.ts';
import { emailLanguagePlan, bilingualSubject, type CustomerLang } from '../_shared/customer-language.ts';
import { formatDateLong, t, SEPARATOR_TEXT } from '../_shared/email-i18n.ts';

interface MenuConfirmationRequest {
  bookingId: string;
  sendEmail: boolean;
  sentBy?: string;
}

interface EmailLogEntry {
  entity_type: string;
  entity_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  provider: string;
  provider_message_id: string | null;
  status: string;
  error_message: string | null;
  sent_by: string | null;
  metadata: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function logEmailDelivery(supabase: any, entry: EmailLogEntry) {
  try {
    const { error } = await supabase.from('email_delivery_logs').insert(entry);
    if (error) console.error('Failed to log email delivery:', error);
  } catch (err) { console.error('Error logging email delivery:', err); }
}

const MENU_LABELS = {
  de: { menu: 'MENÜ', drinks: 'GETRÄNKE' },
  en: { menu: 'MENU', drinks: 'DRINKS' },
  it: { menu: 'MENÙ', drinks: 'BEVANDE' },
  fr: { menu: 'MENU', drinks: 'BOISSONS' },
} as const;

function buildMenuText(menuSelection: any, lng: CustomerLang): string {
  const L = MENU_LABELS[lng];
  let out = '';
  if (menuSelection?.courses?.length) {
    out += `${L.menu}\n\n`;
    for (const c of menuSelection.courses) {
      if (c.itemName) {
        out += `${c.courseLabel}\n${c.itemName}\n`;
        if (c.itemDescription) out += `${c.itemDescription}\n`;
        out += '\n';
      }
    }
  }
  if (menuSelection?.drinks?.length) {
    out += `\n${L.drinks}\n\n`;
    for (const d of menuSelection.drinks) {
      const sel = d.selectedChoice || d.customDrink;
      if (sel) out += `${d.drinkLabel}: ${sel}\n`;
    }
  }
  return out;
}

function buildBodyBlock(lng: CustomerLang, args: {
  customerName: string; packageName: string; eventDate: string; guestCount: number; menuText: string;
}): string {
  const BODIES = {
    de: `Sehr geehrte/r ${args.customerName},

vielen Dank für Ihre Buchung des ${args.packageName} am ${args.eventDate}.

Wir haben folgendes Menü für Ihre Veranstaltung mit ${args.guestCount} Gästen zusammengestellt:

${args.menuText}

Sollten Ihre Gäste besondere Ernährungsbedürfnisse haben (Allergien, vegetarisch, vegan), teilen Sie uns dies bitte rechtzeitig mit. Wir passen das Menü entsprechend an.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen,
Ihr STORIA Team`,
    en: `Dear ${args.customerName},

thank you for booking the ${args.packageName} on ${args.eventDate}.

We have put together the following menu for your event with ${args.guestCount} guests:

${args.menuText}

If your guests have any special dietary needs (allergies, vegetarian, vegan), please let us know in good time and we will adjust the menu accordingly.

Please do not hesitate to contact us with any questions.

Best regards,
Your STORIA Team`,
    it: `Gentile ${args.customerName},

grazie per la prenotazione del ${args.packageName} il ${args.eventDate}.

Abbiamo preparato il seguente menù per il vostro evento con ${args.guestCount} ospiti:

${args.menuText}

Se i vostri ospiti hanno esigenze alimentari particolari (allergie, vegetariano, vegano), vi preghiamo di comunicarcelo per tempo. Adatteremo il menù di conseguenza.

In caso di domande, restiamo a vostra disposizione.

Cordiali saluti,
Il vostro Team STORIA`,
    fr: `Chère/Cher ${args.customerName},

merci pour votre réservation du ${args.packageName} le ${args.eventDate}.

Nous avons composé le menu suivant pour votre événement avec ${args.guestCount} invités :

${args.menuText}

Si vos invités ont des besoins alimentaires particuliers (allergies, végétarien, végan), merci de nous le faire savoir à temps. Nous adapterons le menu en conséquence.

Pour toute question, nous restons à votre disposition.

Cordialement,
Votre équipe STORIA`,
  } as const;
  return BODIES[lng];
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { bookingId, sendEmail, sentBy } = await req.json() as MenuConfirmationRequest;
    if (!bookingId) throw new Error('bookingId is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event = await resolveV2Event(supabase, bookingId);
    if (!event) throw new Error(`v2_event not found for ${bookingId}`);

    const { data: customer } = await supabase
      .from('v2_customers')
      .select('name, email, phone, company')
      .eq('id', event.customer_id)
      .single();
    if (!customer) throw new Error(`v2_customer not found for ${event.customer_id}`);

    let packageData: { name?: string } | null = null;
    if (event.package_id) {
      const { data: pkg } = await supabase.from('packages').select('*').eq('id', event.package_id).single();
      packageData = pkg;
    }

    const lang: CustomerLang = (['de','en','it','fr'] as string[]).includes(event.customer_language)
      ? event.customer_language as CustomerLang : 'de';
    const plan = emailLanguagePlan(lang);
    const packageName = packageData?.name || ({ de: 'Event-Paket', en: 'Event package', it: 'Pacchetto evento', fr: 'Forfait événement' }[plan.primary]);

    const menuSelection = event.menu_selection;

    const subjectFor = (lng: CustomerLang) => ({
      de: `Ihr Menü für ${formatDateLong(lng, event.date)} steht fest`,
      en: `Your menu for ${formatDateLong(lng, event.date)} is confirmed`,
      it: `Il vostro menù per il ${formatDateLong(lng, event.date)} è confermato`,
      fr: `Votre menu pour le ${formatDateLong(lng, event.date)} est confirmé`,
    }[lng]);
    const subject = bilingualSubject(lang, { de: subjectFor('de'), en: subjectFor('en'), it: subjectFor('it'), fr: subjectFor('fr') });
    const isTest = event.is_test === true;
    const safeRecipient = getSafeRecipientEmail(customer.email, isTest);
    const safeSubject = getSafeSubject(subject, isTest);

    const buildFull = (lng: CustomerLang) => buildBodyBlock(lng, {
      customerName: customer.name,
      packageName,
      eventDate: formatDateLong(lng, event.date),
      guestCount: event.guest_count,
      menuText: buildMenuText(menuSelection, lng),
    });

    const primaryBody = buildFull(plan.primary);
    const secondaryBody = plan.secondary ? buildFull(plan.secondary) : '';
    const FOOTER = `\n\nSTORIA · Ristorante\nKarlstraße 47a\n80333 München\nTel: +49 89 51519696\ninfo@events-storia.de`;
    const emailBody = secondaryBody
      ? `${primaryBody}${SEPARATOR_TEXT}${secondaryBody}${FOOTER}`
      : `${primaryBody}${FOOTER}`;

    let emailSent = false;
    let emailProvider = '';
    let emailMessageId: string | null = null;
    let emailError: string | null = null;

    if (sendEmail) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const smtpUser = Deno.env.get('SMTP_USER')?.trim();
      const smtpPassword = Deno.env.get('SMTP_PASSWORD');

      const htmlEmail = `<!DOCTYPE html>
<html lang="${plan.primary}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailBody}</div>
</body></html>`;

      if (resendApiKey) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              from: 'STORIA Events <info@events-storia.de>',
              to: safeRecipient, subject: safeSubject, html: htmlEmail, text: emailBody,
              reply_to: 'info@events-storia.de',
            }),
          });
          if (resendResponse.ok) {
            const resendData = await resendResponse.json();
            emailSent = true; emailProvider = 'resend'; emailMessageId = resendData.id || null;
          } else { emailError = `Resend error: ${await resendResponse.text()}`; console.error(emailError); }
        } catch (e) { emailError = e instanceof Error ? e.message : 'Resend error'; }
      }

      if (!emailSent && smtpUser && smtpPassword) {
        try {
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          const client = new SMTPClient({
            connection: {
              hostname: Deno.env.get('SMTP_HOST') || 'smtp.ionos.de',
              port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
              tls: true, auth: { username: smtpUser, password: smtpPassword },
            },
          });
          await client.send({ from: `STORIA Events <${smtpUser}>`, to: [safeRecipient], subject: safeSubject, html: htmlEmail });
          await client.close();
          emailSent = true; emailProvider = 'ionos_smtp'; emailError = null;
        } catch (e) { emailError = e instanceof Error ? e.message : 'SMTP error'; }
      }

      if (!emailSent && !resendApiKey && !smtpUser) emailError = 'No email provider configured';

      await logEmailDelivery(supabase, {
        entity_type: 'v2_event',
        entity_id: event.id,
        recipient_email: safeRecipient,
        recipient_name: customer.name,
        subject: safeSubject,
        provider: emailProvider || 'none',
        provider_message_id: emailMessageId,
        status: emailSent ? 'sent' : 'failed',
        error_message: emailError,
        sent_by: sentBy || null,
        metadata: {
          booking_number: event.booking_number,
          email_type: 'menu_confirmation',
          package_name: packageName,
          event_date: event.date,
          language: lang,
        },
      });

      if (emailSent) {
        await supabase.from('v2_event_emails').insert({
          event_id: event.id, direction: 'outbound',
          from_email: 'info@events-storia.de', to_email: customer.email,
          subject, body_text: emailBody, body_html: htmlEmail,
          resend_message_id: emailMessageId, resend_status: 'queued',
          sent_at: new Date().toISOString(),
        });
      }
    }

    await supabase.from('v2_events').update({
      menu_confirmed: true,
      menu_confirmed_at: new Date().toISOString(),
      confirmation_email_sent_at: emailSent ? new Date().toISOString() : null,
    }).eq('id', event.id);

    return new Response(
      JSON.stringify({ success: true, emailSent, bookingNumber: event.booking_number, provider: emailProvider || undefined, language: lang }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }, status: 200 },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }, status: 400 },
    );
  }
});
