import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { resolveV2Event } from '../_shared/v2-lookup.ts';
import { getSafeRecipientEmail, getSafeSubject } from '../_shared/test-safety.ts';


serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inquiryId } = await req.json();
    if (!inquiryId) {
      return new Response(JSON.stringify({ error: "inquiryId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve v2_event aus Legacy- oder v2-UUID
    const event = await resolveV2Event(supabase, inquiryId);
    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Customer separat
    const { data: customer } = await supabase
      .from("v2_customers")
      .select("name, email, company")
      .eq("id", event.customer_id)
      .single();

    // Gewählte Option direkt aus v2_offer_options
    const { data: chosenOption } = await supabase
      .from("v2_offer_options")
      .select("id, label, package_name_snapshot, chosen_at, chosen_notes, menu_selection")
      .eq("event_id", event.id)
      .eq("is_chosen", true)
      .order("chosen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const selectedOptionLabel = chosenOption
      ? `Option ${chosenOption.label}${chosenOption.package_name_snapshot ? ` (${chosenOption.package_name_snapshot})` : ""}`
      : "Keine";
    const customerNotes = chosenOption?.chosen_notes || "Keine Anmerkungen";

    // Equipment & Staff aus menu_selection extrahieren
    const ms = (chosenOption?.menu_selection || {}) as Record<string, unknown>;
    const equipItems = (Array.isArray(ms.equipment) ? ms.equipment : []) as Array<{ name: string; pricePerUnit: number; quantity: number }>;
    const staffItems = (Array.isArray(ms.staff) ? ms.staff : []) as Array<{ name: string; pricePerUnit: number; quantity: number }>;
    const validEquip = equipItems.filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0);
    const validStaff = staffItems.filter(e => e.name && e.pricePerUnit > 0 && e.quantity > 0);

    let serviceLines = '';
    if (validEquip.length > 0) {
      serviceLines += '\nEquipment:\n' + validEquip.map(e => `  ${e.quantity > 1 ? `${e.quantity} × ` : ''}${e.name} — ${(e.pricePerUnit * e.quantity).toFixed(2)} €`).join('\n');
    }
    if (validStaff.length > 0) {
      serviceLines += '\nPersonal:\n' + validStaff.map(s => `  ${s.quantity > 1 ? `${s.quantity} × ` : ''}${s.name} — ${(s.pricePerUnit * s.quantity).toFixed(2)} €`).join('\n');
    }

    const customerName = customer?.company || customer?.name || "Unbekannt";
    const eventDate = event.date || "Kein Datum";
    const guestCount = event.guest_count || "?";
    const paymentMethod = event.payment_method || 'deposit_online';
    const isOfflineBooking = paymentMethod === 'on_site' || paymentMethod === 'invoice_after';
    const isTest = event.is_test === true;

    const emailSubject = `Kundenantwort: ${customerName} hat Option gewählt`;
    const emailText = `Neue Kundenantwort auf Angebot

Kunde: ${customerName}
E-Mail: ${customer?.email || ""}
Event: ${event.occasion || "Veranstaltung"} am ${eventDate}
Gäste: ${guestCount}

Gewählte Option: ${selectedOptionLabel}
Anmerkungen: ${customerNotes}${serviceLines}

→ Angebot jetzt finalisieren:
https://events-storia.de/admin/events/${inquiryId}/edit`;

    const htmlBody = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailText}</div>
</body></html>`;

    const notificationRecipients = [
      "info@events-storia.de",
    ];

    // Admin-Benachrichtigung: IONOS SMTP primär (eigene Domain → sofortige Zustellung,
    // umgeht das Resend→IONOS-MX "delayed"-Problem bei info@events-storia.de),
    // Resend nur als Fallback.
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    let sent = false;
    let provider = "";
    let messageId: string | null = null;
    let errorMessage: string | null = null;

    // IONOS SMTP (primär für interne Empfänger)
    if (smtpUser && smtpPassword) {
      try {
        const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
        const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
        const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");

        const client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            tls: true,
            auth: { username: smtpUser, password: smtpPassword },
          },
        });

        await client.send({
          from: `STORIA Events <${smtpUser}>`,
          to: notificationRecipients,
          subject: emailSubject,
          html: htmlBody,
        });
        await client.close();
        sent = true;
        provider = "ionos_smtp";
        errorMessage = null;
        console.log("Notification sent via IONOS SMTP (primary) to:", notificationRecipients.join(", "));
      } catch (smtpError) {
        errorMessage = smtpError instanceof Error ? smtpError.message : "SMTP error";
        console.error("IONOS SMTP (primary) error:", errorMessage);
      }
    }

    // Resend (Fallback)
    if (!sent && resendApiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({
            from: "STORIA Events <info@events-storia.de>",
            to: notificationRecipients,
            subject: emailSubject,
            html: htmlBody,
            text: emailText,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          sent = true;
          provider = "resend";
          messageId = data.id || null;
          errorMessage = null;
          console.log("Notification sent via Resend (fallback) to:", notificationRecipients.join(", "));
        } else {
          errorMessage = `Resend error: ${await res.text()}`;
          console.error(errorMessage);
        }
      } catch (resendErr) {
        errorMessage = resendErr instanceof Error ? resendErr.message : "Resend error";
        console.error("Resend exception:", errorMessage);
      }
    }

    // Log in email_delivery_logs
    await supabase.from("email_delivery_logs").insert({
      entity_type: "v2_event",
      entity_id: event.id,
      recipient_email: notificationRecipients.join(", "),
      recipient_name: "STORIA Team",
      subject: emailSubject,
      provider: provider || "none",
      provider_message_id: messageId,
      status: sent ? "sent" : "failed",
      error_message: errorMessage,
      sent_by: "system",
      metadata: {
        selectedOptionLabel,
        customerNotes,
        chosenOptionId: chosenOption?.id || null,
      },
    });

    // --- Kunden-Bestätigungs-E-Mail bei Offline-Buchung ---
    if (isOfflineBooking && customer?.email) {
      const paymentInfo = paymentMethod === 'on_site'
        ? 'Zahlung bequem vor Ort am Tag der Veranstaltung.'
        : `Die Rechnung wird Ihnen in Kürze per E-Mail zugestellt. Zahlungsziel: ${event.invoice_due_days ?? 14} Tage nach der Veranstaltung.`;

      const customerEmailText = `STORIA · EVENTS & CATERING

Guten Tag ${customer.name || 'geschätzter Gast'},

vielen Dank für Ihre verbindliche Buchung!

Wir freuen uns, Ihre Veranstaltung begleiten zu dürfen.


IHRE BUCHUNG

Event: ${event.occasion || 'Veranstaltung'}
Datum: ${eventDate}
Gästeanzahl: ${guestCount}
Gewählte Option: ${selectedOptionLabel}
${serviceLines ? `\n${serviceLines.trim()}\n` : ''}

Zahlung: ${paymentInfo}


Bei Fragen erreichen Sie uns unter:
Tel: +49 89 51519696
E-Mail: info@events-storia.de

Wir freuen uns auf Ihre Veranstaltung!

STORIA · Ristorante
Karlstraße 47a
80333 München

events-storia.de
`;

      const customerHtmlBody = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${customerEmailText}</div>
</body></html>`;

      const safeCustomerEmail = getSafeRecipientEmail(customer.email, isTest);
      const safeCustomerSubject = getSafeSubject('Ihre Buchung bei STORIA ist bestätigt', isTest);

      // Send customer confirmation (Resend primary, SMTP fallback)
      let custSent = false;
      let custProvider = '';
      let custMessageId: string | null = null;
      let custError: string | null = null;

      if (resendApiKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({
              from: "STORIA Events <info@events-storia.de>",
              to: [safeCustomerEmail],
              subject: safeCustomerSubject,
              html: customerHtmlBody,
              text: customerEmailText,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            custSent = true;
            custProvider = "resend";
            custMessageId = data.id || null;
            console.log("Customer confirmation sent via Resend to:", safeCustomerEmail);
          } else {
            custError = `Resend error: ${await res.text()}`;
            console.error("Customer email Resend error:", custError);
          }
        } catch (e) {
          custError = e instanceof Error ? e.message : "Resend error";
          console.error("Customer email Resend exception:", custError);
        }
      }

      if (!custSent && smtpUser && smtpPassword) {
        try {
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
          const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
          const client = new SMTPClient({
            connection: { hostname: smtpHost, port: smtpPort, tls: true, auth: { username: smtpUser, password: smtpPassword } },
          });
          await client.send({
            from: `STORIA Events <${smtpUser}>`,
            to: [safeCustomerEmail],
            subject: safeCustomerSubject,
            html: customerHtmlBody,
          });
          await client.close();
          custSent = true;
          custProvider = "ionos_smtp";
          custError = null;
          console.log("Customer confirmation sent via IONOS SMTP to:", safeCustomerEmail);
        } catch (e) {
          custError = e instanceof Error ? e.message : "SMTP error";
          console.error("Customer email SMTP error:", custError);
        }
      }

      // Log customer confirmation email
      await supabase.from("email_delivery_logs").insert({
        entity_type: "v2_event",
        entity_id: event.id,
        recipient_email: customer.email,
        recipient_name: customer.name || customer.company || "Kunde",
        subject: "Ihre Buchung bei STORIA ist bestätigt",
        provider: custProvider || "none",
        provider_message_id: custMessageId,
        status: custSent ? "sent" : "failed",
        error_message: custError,
        sent_by: "system",
        metadata: {
          email_type: "offline_booking_confirmation_customer",
          payment_method: paymentMethod,
          selectedOptionLabel,
        },
      });
    }

    // --- Automatische LexOffice-Rechnung bei invoice_after ---
    let invoiceResult: { success: boolean; quotationId?: string; error?: string } | null = null;
    if (paymentMethod === 'invoice_after') {
      try {
        console.log(`[notify-customer-response] Creating LexOffice invoice for inquiry ${inquiryId} (invoice_after)`);
        const invoiceRes = await fetch(
          `${supabaseUrl}/functions/v1/create-event-quotation`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inquiryId,
              useSelectedQuantity: true,
              forceDocumentType: 'invoice',
            }),
          },
        );
        invoiceResult = await invoiceRes.json();
        console.log('[notify-customer-response] Invoice creation result:', JSON.stringify(invoiceResult));

        // Log activity
        await supabase.from("activity_logs").insert({
          entity_type: "event_inquiry",
          entity_id: event.id,
          action: "lexoffice_invoice_created",
          new_value: { invoice_id: invoiceResult?.quotationId, payment_method: 'invoice_after' },
          metadata: { triggered_by: 'auto_offline_booking' },
        });
      } catch (invoiceErr) {
        const errMsg = invoiceErr instanceof Error ? invoiceErr.message : 'Unknown invoice error';
        console.error('[notify-customer-response] Auto invoice creation failed:', errMsg);

        // Log failure but don't block the response
        await supabase.from("activity_logs").insert({
          entity_type: "event_inquiry",
          entity_id: event.id,
          action: "lexoffice_invoice_failed",
          new_value: { error: errMsg, payment_method: 'invoice_after' },
          metadata: { triggered_by: 'auto_offline_booking' },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, emailSent: sent, invoiceResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
