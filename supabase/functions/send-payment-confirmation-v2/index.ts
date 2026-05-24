import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSafeRecipientEmail, getSafeSubject } from "../_shared/test-safety.ts";

const log = (step: string, details?: Record<string, unknown>) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-PAYMENT-CONFIRMATION-V2] ${step}${d}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payment_id, include_apology = false } = await req.json();
    if (!payment_id) throw new Error("payment_id ist erforderlich");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Load payment
    const { data: payment, error: payErr } = await supabase
      .from("v2_payments")
      .select("id, event_id, amount_cents, payment_type, status, paid_at")
      .eq("id", payment_id)
      .single();
    if (payErr || !payment) throw new Error("Zahlung nicht gefunden");
    if (payment.status !== "paid") throw new Error("Zahlung ist nicht als bezahlt markiert");

    // Load event + customer
    const { data: ev, error: evErr } = await supabase
      .from("v2_events")
      .select("id, customer_id, booking_number, date, time_from, event_time, amount_total, is_test")
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

    const typeLabel = payment.payment_type === "deposit" ? "Anzahlung" : "Zahlung";
    const amountFormatted = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })
      .format((payment.amount_cents || 0) / 100);
    const totalFormatted = ev.amount_total
      ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(ev.amount_total))
      : null;
    const remainingCents = Math.max(
      0,
      Math.round(Number(ev.amount_total || 0) * 100) - (payment.amount_cents || 0),
    );
    const remainingFormatted = remainingCents > 0
      ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(remainingCents / 100)
      : null;
    const eventDateStr = ev.date ? new Date(ev.date).toLocaleDateString("de-DE") : null;
    const bookingNumber = ev.booking_number || "—";

    const subject = `Zahlungseingang bestätigt: ${typeLabel}${ev.booking_number ? ` – ${ev.booking_number}` : ""}`;
    const isTest = ev.is_test === true;
    const safeEmail = getSafeRecipientEmail(customer.email, isTest);
    const safeSubject = getSafeSubject(subject, isTest);

    const html = buildHtml({
      customerName: customer.name || "Sehr geehrte Damen und Herren",
      typeLabel,
      amountFormatted,
      totalFormatted,
      remainingFormatted,
      eventDateStr,
      bookingNumber,
      includeApology: !!include_apology,
    });

    log("Sending via Resend", { to: safeEmail, subject: safeSubject, include_apology });

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
      description: `Zahlungsbestätigung an ${customer.email} versendet (${amountFormatted}${include_apology ? ", mit Entschuldigung" : ""})`,
      metadata: {
        payment_id,
        with_apology: !!include_apology,
        amount_cents: payment.amount_cents,
        payment_type: payment.payment_type,
        message_id: messageId,
      },
    });

    return new Response(JSON.stringify({ success: true, messageId }), {
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

function buildHtml(o: {
  customerName: string;
  typeLabel: string;
  amountFormatted: string;
  totalFormatted: string | null;
  remainingFormatted: string | null;
  eventDateStr: string | null;
  bookingNumber: string;
  includeApology: boolean;
}): string {
  const apologyBlock = o.includeApology
    ? `<div style="background-color:#fff8ea;border:1px solid #f1d9a2;border-radius:8px;padding:16px 18px;margin:0 0 24px;">
         <p style="color:#5a3a05;font-size:14px;line-height:1.6;margin:0;">
           Aufgrund eines technischen Fehlers ist die Bestätigung Ihrer ${o.typeLabel} leider verspätet bei Ihnen eingetroffen.
           Bitte entschuldigen Sie diese Verzögerung. Ihre ${o.typeLabel} in Höhe von <strong>${o.amountFormatted}</strong>
           ist bei uns eingegangen und wurde erfolgreich verbucht.
         </p>
       </div>`
    : "";

  const summaryRows = [
    o.bookingNumber !== "—" ? `<tr><td style="padding:6px 0;color:#777777;">Buchungsnummer</td><td style="padding:6px 0;color:#1a1a1a;text-align:right;">${o.bookingNumber}</td></tr>` : "",
    `<tr><td style="padding:6px 0;color:#777777;">${o.typeLabel}</td><td style="padding:6px 0;color:#1a1a1a;text-align:right;"><strong>${o.amountFormatted}</strong></td></tr>`,
    o.totalFormatted ? `<tr><td style="padding:6px 0;color:#777777;">Gesamtsumme</td><td style="padding:6px 0;color:#1a1a1a;text-align:right;">${o.totalFormatted}</td></tr>` : "",
    o.remainingFormatted ? `<tr><td style="padding:6px 0;color:#777777;">Noch offen</td><td style="padding:6px 0;color:#1a1a1a;text-align:right;">${o.remainingFormatted}</td></tr>` : "",
    o.eventDateStr ? `<tr><td style="padding:6px 0;color:#777777;">Veranstaltungsdatum</td><td style="padding:6px 0;color:#1a1a1a;text-align:right;">${o.eventDateStr}</td></tr>` : "",
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background-color:#1a1a1a;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-family:Arial,sans-serif;">STORIA Events</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">Zahlung erhalten – Vielen Dank!</h2>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">Guten Tag ${o.customerName},</p>
          ${apologyBlock}
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">
            wir bestätigen hiermit den Eingang Ihrer ${o.typeLabel} und freuen uns auf Ihre Veranstaltung mit uns.
          </p>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
            ${summaryRows}
          </table>
          ${o.remainingFormatted ? `<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Den noch offenen Betrag von <strong>${o.remainingFormatted}</strong> stellen wir Ihnen rechtzeitig vor der Veranstaltung in Rechnung.
          </p>` : ""}
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
            <strong>Stornobedingungen:</strong><br/>
            Bis 30 Tage vorher: kostenlos &middot; 14–30 Tage: 25&nbsp;% &middot; 7–14 Tage: 50&nbsp;% &middot; 2–7 Tage: 80&nbsp;% &middot; Unter 48&nbsp;Std./No-Show: 100&nbsp;% abzgl. ersparter Aufwendungen.<br/>
            <span style="font-size:13px;color:#666666;">
              Vollständige AGB: <a href="https://www.events-storia.de/agb-veranstaltungen" style="color:#b45309;">events-storia.de/agb-veranstaltungen</a>
            </span>
          </p>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:24px 0 0;">
            Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung:<br/>
            <a href="tel:+498995457475" style="color:#b45309;text-decoration:none;">089 954 574 750</a>
            oder <a href="mailto:info@events-storia.de" style="color:#b45309;text-decoration:none;">info@events-storia.de</a>
          </p>
          <p style="color:#333333;font-size:15px;line-height:1.6;margin:16px 0 0;">
            Herzliche Grüße,<br/><strong>Ihr STORIA Events Team</strong>
          </p>
        </td></tr>
        <tr><td style="background-color:#f5f5f0;padding:20px 32px;font-size:11px;color:#777777;border-top:1px solid #e5e5e5;">
          <p style="margin:0 0 8px;"><a href="https://events-storia.de/datenschutz" style="color:#b45309;">Datenschutzerklärung</a> · <a href="https://events-storia.de/impressum" style="color:#b45309;margin-left:8px;">Impressum</a></p>
          <p style="margin:0;">Dream &amp; Anchor Handelsgesellschaft mbH · Karlstraße 47a · 80333 München · info@events-storia.de · +49 89 954 574 750</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}