import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { resolveV2Event } from '../_shared/v2-lookup.ts';



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
      .select("id, label, package_name_snapshot, chosen_at, chosen_notes")
      .eq("event_id", event.id)
      .eq("is_chosen", true)
      .order("chosen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const selectedOptionLabel = chosenOption
      ? `Option ${chosenOption.label}${chosenOption.package_name_snapshot ? ` (${chosenOption.package_name_snapshot})` : ""}`
      : "Keine";
    const customerNotes = chosenOption?.chosen_notes || "Keine Anmerkungen";

    const customerName = customer?.company || customer?.name || "Unbekannt";
    const eventDate = event.date || "Kein Datum";
    const guestCount = event.guest_count || "?";

    const emailSubject = `Kundenantwort: ${customerName} hat Option gewählt`;
    const emailText = `Neue Kundenantwort auf Angebot

Kunde: ${customerName}
E-Mail: ${customer?.email || ""}
Event: ${event.occasion || "Veranstaltung"} am ${eventDate}
Gäste: ${guestCount}

Gewählte Option: ${selectedOptionLabel}
Anmerkungen: ${customerNotes}

→ Angebot jetzt finalisieren:
https://events-storia.de/admin/events/${inquiryId}/edit`;

    const htmlBody = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailText}</div>
</body></html>`;

    const notificationRecipients = [
      "info@events-storia.de",
      "d.speranza@storia-muenchen.de",
    ];

    // Sende per Resend (primär) oder SMTP (fallback)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    let sent = false;
    let provider = "";
    let messageId: string | null = null;
    let errorMessage: string | null = null;

    // Resend (primär)
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
          console.log("Notification sent via Resend to:", notificationRecipients.join(", "));
        } else {
          errorMessage = `Resend error: ${await res.text()}`;
          console.error(errorMessage);
        }
      } catch (resendErr) {
        errorMessage = resendErr instanceof Error ? resendErr.message : "Resend error";
        console.error("Resend exception:", errorMessage);
      }
    }

    // SMTP Fallback
    if (!sent && smtpUser && smtpPassword) {
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
        console.log("Notification sent via IONOS SMTP (fallback) to:", notificationRecipients.join(", "));
      } catch (smtpError) {
        errorMessage = smtpError instanceof Error ? smtpError.message : "SMTP error";
        console.error("SMTP fallback error:", errorMessage);
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

    return new Response(JSON.stringify({ success: true, emailSent: sent }), {
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
