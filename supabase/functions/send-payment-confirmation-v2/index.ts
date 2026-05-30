import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSafeRecipientEmail, getSafeSubject } from "../_shared/test-safety.ts";
import {
  resolveCustomerLanguage, emailLanguagePlan, bilingualSubject,
  type CustomerLang,
} from "../_shared/customer-language.ts";
import {
  formatCurrency, formatCurrencyEuro, formatDate, paymentTypeLabel, t, SEPARATOR_HTML,
} from "../_shared/email-i18n.ts";

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-PAYMENT-CONFIRMATION-V2] ${step}${d}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      payment_id,
      include_apology = false,
      mode = "confirmation",
      prepayment,
    } = await req.json() as {
      payment_id: string;
      include_apology?: boolean;
      mode?: "confirmation" | "prepayment_invite";
      prepayment?: {
        paymentLinkUrl: string;
        pricePerPersonCents: number;
        minGuests: number;
        maxGuests?: number;
      };
    };
    if (!payment_id) throw new Error("payment_id ist erforderlich");
    const isPrepaymentInvite = mode === "prepayment_invite";
    if (isPrepaymentInvite && (!prepayment || !prepayment.paymentLinkUrl)) {
      throw new Error("prepayment.paymentLinkUrl erforderlich für prepayment_invite");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: payment, error: payErr } = await supabase
      .from("v2_payments")
      .select("id, event_id, amount_cents, payment_type, status, paid_at")
      .eq("id", payment_id)
      .single();
    if (payErr || !payment) throw new Error("Zahlung nicht gefunden");
    if (!isPrepaymentInvite && payment.status !== "paid") {
      throw new Error("Zahlung ist nicht als bezahlt markiert");
    }

    const { data: ev, error: evErr } = await supabase
      .from("v2_events")
      .select("id, customer_id, booking_number, date, time_from, event_time, amount_total, is_test, deposit_method, balance_method, customer_language")
      .eq("id", payment.event_id)
      .single();
    if (evErr || !ev) throw new Error("Event nicht gefunden");

    const { data: customer, error: custErr } = await supabase
      .from("v2_customers")
      .select("id, name, email, company")
      .eq("id", ev.customer_id)
      .single();
    if (custErr || !customer?.email) throw new Error("Keine Kunden-E-Mail hinterlegt");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY nicht konfiguriert");

    const lang: CustomerLang = (['de','en','it','fr'] as CustomerLang[]).includes(ev.customer_language as CustomerLang)
      ? ev.customer_language as CustomerLang
      : await resolveCustomerLanguage(supabase, ev.id).catch(() => 'de' as CustomerLang);
    const plan = emailLanguagePlan(lang);

    const remainingCents = Math.max(
      0,
      Math.round(Number(ev.amount_total || 0) * 100) - (payment.amount_cents || 0),
    );
    const bookingNumber = ev.booking_number || "—";
    const isTest = ev.is_test === true;
    const safeEmail = getSafeRecipientEmail(customer.email, isTest);

    const subjectFor = (lng: CustomerLang) => {
      const typeLbl = paymentTypeLabel(lng, payment.payment_type);
      if (isPrepaymentInvite) {
        return ({
          de: `Restzahlung Ihrer Veranstaltung${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
          en: `Balance payment for your event${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
          it: `Saldo del vostro evento${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
          fr: `Solde de votre événement${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
        }[lng]);
      }
      return ({
        de: `Zahlungseingang bestätigt: ${typeLbl}${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
        en: `Payment received: ${typeLbl}${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
        it: `Pagamento ricevuto: ${typeLbl}${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
        fr: `Paiement reçu : ${typeLbl}${ev.booking_number ? ` – ${ev.booking_number}` : ""}`,
      }[lng]);
    };
    const subjects: Record<CustomerLang, string> = {
      de: subjectFor('de'), en: subjectFor('en'), it: subjectFor('it'), fr: subjectFor('fr'),
    };
    const subject = bilingualSubject(lang, subjects);
    const safeSubject = getSafeSubject(subject, isTest);

    const labels = {
      de: { booking: 'Buchungsnummer', date: 'Veranstaltungsdatum', total: 'Gesamtsumme', remaining: 'Noch offen', pricePerGuest: 'Preis pro Gast', minGuests: 'Mindestpersonenzahl', heading_prepay: 'Restzahlung Ihrer Veranstaltung', heading_paid: 'Zahlung erhalten – Vielen Dank!', payCta: 'Jetzt Restbetrag begleichen →' },
      en: { booking: 'Booking number', date: 'Event date', total: 'Total amount', remaining: 'Outstanding', pricePerGuest: 'Price per guest', minGuests: 'Minimum guests', heading_prepay: 'Balance payment for your event', heading_paid: 'Payment received – Thank you!', payCta: 'Pay balance now →' },
      it: { booking: 'Numero prenotazione', date: "Data dell'evento", total: 'Totale', remaining: 'Da saldare', pricePerGuest: 'Prezzo per ospite', minGuests: 'Numero minimo ospiti', heading_prepay: 'Saldo del vostro evento', heading_paid: 'Pagamento ricevuto – Grazie!', payCta: 'Paga il saldo ora →' },
      fr: { booking: 'Numéro de réservation', date: "Date de l'événement", total: 'Montant total', remaining: 'Restant dû', pricePerGuest: 'Prix par invité', minGuests: "Nombre minimum d'invités", heading_prepay: 'Solde de votre événement', heading_paid: 'Paiement reçu – Merci !', payCta: 'Payer le solde →' },
    } as const;

    const buildBlock = (lng: CustomerLang) => {
      const L = labels[lng];
      const typeLbl = paymentTypeLabel(lng, payment.payment_type);
      const amt = formatCurrency(lng, payment.amount_cents || 0);
      const totalStr = ev.amount_total ? formatCurrencyEuro(lng, Number(ev.amount_total)) : null;
      const remStr = remainingCents > 0 ? formatCurrency(lng, remainingCents) : null;
      const eventDateStr = ev.date ? formatDate(lng, ev.date) : null;

      const apologyMap = {
        de: `Aufgrund eines technischen Fehlers ist die Bestätigung Ihrer ${typeLbl} leider verspätet bei Ihnen eingetroffen. Bitte entschuldigen Sie diese Verzögerung. Ihre ${typeLbl} in Höhe von <strong>${amt}</strong> ist bei uns eingegangen.`,
        en: `Due to a technical issue, the confirmation of your ${typeLbl} reached you late. Please accept our apologies. Your ${typeLbl} of <strong>${amt}</strong> has been received.`,
        it: `A causa di un problema tecnico, la conferma del vostro ${typeLbl} è arrivata in ritardo. Ce ne scusiamo. Il vostro ${typeLbl} di <strong>${amt}</strong> è stato ricevuto.`,
        fr: `En raison d'un problème technique, la confirmation de votre ${typeLbl} vous est parvenue en retard. Veuillez nous en excuser. Votre ${typeLbl} de <strong>${amt}</strong> a bien été reçu.`,
      } as const;
      const apologyBlock = include_apology ? `<div style="background-color:#fff8ea;border:1px solid #f1d9a2;border-radius:8px;padding:16px 18px;margin:0 0 24px;"><p style="color:#5a3a05;font-size:14px;line-height:1.6;margin:0;">${apologyMap[lng]}</p></div>` : '';

      const introMap = isPrepaymentInvite ? {
        de: 'wir freuen uns auf Ihre Veranstaltung. Damit wir alles bestmöglich vorbereiten können, bitten wir Sie um die Vorab-Begleichung des Restbetrags.',
        en: 'we look forward to your event. So we can prepare everything in the best way, please settle the outstanding balance in advance.',
        it: 'siamo lieti di accogliervi al vostro evento. Per prepararci al meglio, vi chiediamo di saldare in anticipo l\'importo residuo.',
        fr: 'nous nous réjouissons de votre événement. Pour tout préparer au mieux, merci de régler le solde par avance.',
      }[lng] : ({
        de: `wir bestätigen hiermit den Eingang Ihrer ${typeLbl} und freuen uns auf Ihre Veranstaltung mit uns.`,
        en: `we hereby confirm receipt of your ${typeLbl} and look forward to your event with us.`,
        it: `confermiamo la ricezione del vostro ${typeLbl} e siamo felici di accogliervi al vostro evento.`,
        fr: `nous confirmons la réception de votre ${typeLbl} et nous nous réjouissons de votre événement.`,
      }[lng]);

      const rowsHtml = (isPrepaymentInvite ? [
        bookingNumber !== "—" ? [L.booking, bookingNumber] : null,
        eventDateStr ? [L.date, eventDateStr] : null,
        [L.pricePerGuest, `<strong>${formatCurrency(lng, prepayment!.pricePerPersonCents)}</strong>`],
        [L.minGuests, String(prepayment!.minGuests)],
      ] : [
        bookingNumber !== "—" ? [L.booking, bookingNumber] : null,
        [typeLbl, `<strong>${amt}</strong>`],
        totalStr ? [L.total, totalStr] : null,
        remStr ? [L.remaining, remStr] : null,
        eventDateStr ? [L.date, eventDateStr] : null,
      ])
        .filter(Boolean)
        .map((r) => `<tr><td style="padding:6px 0;color:#777777;">${(r as string[])[0]}</td><td style="padding:6px 0;color:#1a1a1a;text-align:right;">${(r as string[])[1]}</td></tr>`)
        .join('');

      const prepayCtaText = {
        de: `Bitte geben Sie Ihre <strong>finale Gästezahl</strong> ein (mindestens <strong>${prepayment?.minGuests}</strong>, gerne auch mehr) und begleichen Sie den Restbetrag direkt per Kreditkarte:`,
        en: `Please enter your <strong>final guest count</strong> (at least <strong>${prepayment?.minGuests}</strong>, more is welcome) and settle the balance by credit card:`,
        it: `Inserite il <strong>numero finale di ospiti</strong> (almeno <strong>${prepayment?.minGuests}</strong>, anche di più) e saldate il residuo con carta di credito:`,
        fr: `Saisissez le <strong>nombre final d'invités</strong> (au moins <strong>${prepayment?.minGuests}</strong>) et réglez le solde par carte bancaire :`,
      }[lng];
      const prepayNote = {
        de: `Die endgültige Summe ergibt sich aus <strong>${formatCurrency(lng, prepayment?.pricePerPersonCents || 0)} × gewählte Personenzahl</strong>.`,
        en: `The final total equals <strong>${formatCurrency(lng, prepayment?.pricePerPersonCents || 0)} × chosen number of guests</strong>.`,
        it: `Il totale finale è <strong>${formatCurrency(lng, prepayment?.pricePerPersonCents || 0)} × numero di ospiti scelto</strong>.`,
        fr: `Le total final correspond à <strong>${formatCurrency(lng, prepayment?.pricePerPersonCents || 0)} × nombre d'invités choisi</strong>.`,
      }[lng];

      const prepayBlock = isPrepaymentInvite && prepayment ? `
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">${prepayCtaText}</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td>
          <a href="${prepayment.paymentLinkUrl}" style="display:inline-block;background-color:#b45309;color:#ffffff;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:8px;text-decoration:none;">${L.payCta}</a>
        </td></tr></table>
        <p style="color:#666666;font-size:13px;line-height:1.6;margin:0 0 24px;">${prepayNote}</p>` : '';

      let balanceText = '';
      if (!isPrepaymentInvite && remStr) {
        const balanceMap = ev.balance_method === 'on_site' ? {
          de: `Den noch offenen Betrag von <strong>${remStr}</strong> begleichen Sie bitte <strong>vor Ort beim Event</strong> (bar oder Karte).`,
          en: `Please settle the outstanding amount of <strong>${remStr}</strong> <strong>on site at the event</strong> (cash or card).`,
          it: `Saldate l'importo residuo di <strong>${remStr}</strong> <strong>sul posto durante l'evento</strong> (contanti o carta).`,
          fr: `Veuillez régler le solde de <strong>${remStr}</strong> <strong>sur place lors de l'événement</strong> (espèces ou carte).`,
        } : ev.balance_method === 'invoice_after' ? {
          de: `Den noch offenen Betrag von <strong>${remStr}</strong> stellen wir Ihnen nach der Veranstaltung in Rechnung.`,
          en: `We will invoice the outstanding amount of <strong>${remStr}</strong> after the event.`,
          it: `L'importo residuo di <strong>${remStr}</strong> verrà fatturato dopo l'evento.`,
          fr: `Le solde de <strong>${remStr}</strong> vous sera facturé après l'événement.`,
        } : {
          de: `Den noch offenen Betrag von <strong>${remStr}</strong> stellen wir Ihnen rechtzeitig vor der Veranstaltung in Rechnung.`,
          en: `We will invoice the outstanding amount of <strong>${remStr}</strong> ahead of the event.`,
          it: `L'importo residuo di <strong>${remStr}</strong> verrà fatturato in tempo utile prima dell'evento.`,
          fr: `Le solde de <strong>${remStr}</strong> vous sera facturé en temps utile avant l'événement.`,
        };
        balanceText = `<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">${balanceMap[lng]}</p>`;
      }

      return `
        <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">${isPrepaymentInvite ? L.heading_prepay : L.heading_paid}</h2>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">${t(lng, 'greeting')} ${customer.name || ''},</p>
        ${apologyBlock}
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">${introMap}</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">${rowsHtml}</table>
        ${prepayBlock}
        ${balanceText}
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
          <strong>${t(lng, 'cancellationTermsTitle')}</strong><br/>
          ${t(lng, 'cancellationTermsBody')}<br/>
          <span style="font-size:13px;color:#666666;">${t(lng, 'cancellationTermsFootnote')} <a href="https://www.events-storia.de/agb-veranstaltungen" style="color:#b45309;">events-storia.de/agb-veranstaltungen</a></span>
        </p>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:24px 0 0;">${t(lng, 'questionsLine')}<br/>
          <a href="tel:+498951519696" style="color:#b45309;text-decoration:none;">089 51519696</a>
          – <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none;">info@events-storia.de</a></p>
        <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">${t(lng, 'signOff')}<br/><strong>${t(lng, 'teamSignature')}</strong></p>`;
    };

    const primaryBlock = buildBlock(plan.primary);
    const secondaryBlock = plan.secondary ? `${SEPARATOR_HTML}${buildBlock(plan.secondary)}` : '';

    const html = `<!DOCTYPE html>
<html lang="${plan.primary}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;padding:32px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background-color:#1a1a1a;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif;">STORIA Events</h1>
      </td></tr>
      <tr><td style="padding:32px;">${primaryBlock}${secondaryBlock}</td></tr>
      <tr><td style="background-color:#f5f5f0;padding:20px 32px;font-size:11px;color:#777777;border-top:1px solid #e5e5e5;">
        <p style="margin:0 0 8px;"><a href="https://events-storia.de/datenschutz" style="color:#b45309;">${t(plan.primary, 'privacyImprint')}</a> · <a href="https://events-storia.de/impressum" style="color:#b45309;margin-left:8px;">${t(plan.primary, 'imprint')}</a></p>
        <p style="margin:0;">Speranza GmbH · Karlstraße 47a · 80333 München · info@events-storia.de · +49 89 51519696</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

    log("Sending via Resend", { to: safeEmail, subject: safeSubject, lang });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: "STORIA Events <info@events-storia.de>",
        to: [safeEmail],
        bcc: ["info@events-storia.de"],
        subject: safeSubject,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend Fehler (${res.status}): ${errText}`);
    }
    const { id: messageId } = await res.json();
    log("Email sent", { messageId });

    await supabase.from("activity_logs").insert({
      entity_type: "event_inquiry",
      entity_id: ev.id,
      action: "payment_confirmation_email_sent",
      description: `Zahlungsbestätigung an ${customer.email} versendet (${formatCurrency(lang, payment.amount_cents || 0)}${include_apology ? ", mit Entschuldigung" : ""}, lang=${lang})`,
      metadata: {
        payment_id,
        with_apology: !!include_apology,
        amount_cents: payment.amount_cents,
        payment_type: payment.payment_type,
        message_id: messageId,
        language: lang,
      },
    });

    return new Response(JSON.stringify({ success: true, messageId, language: lang }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    log("ERROR", { error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
