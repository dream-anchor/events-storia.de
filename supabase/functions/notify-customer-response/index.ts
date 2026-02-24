import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



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

    // Anfrage + Kundenantwort laden
    const { data: inquiry, error: inquiryError } = await supabase
      .from("event_inquiries")
      .select("id, company_name, contact_name, email, preferred_date, guest_count, event_type")
      .eq("id", inquiryId)
      .single();

    if (inquiryError || !inquiry) {
      console.error("Inquiry not found:", inquiryError);
      return new Response(JSON.stringify({ error: "Inquiry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: response } = await supabase
      .from("offer_customer_responses")
      .select("selected_option_id, customer_notes, responded_at")
      .eq("inquiry_id", inquiryId)
      .order("responded_at", { ascending: false })
      .limit(1)
      .single();

    // Gewählte Option laden
    let selectedOptionLabel = "Keine";
    if (response?.selected_option_id) {
      const { data: option } = await supabase
        .from("inquiry_offer_options")
        .select("option_label, package_name")
        .eq("id", response.selected_option_id)
        .single();
      if (option) {
        selectedOptionLabel = `Option ${option.option_label}${option.package_name ? ` (${option.package_name})` : ""}`;
      }
    }

    const customerName = inquiry.company_name || inquiry.contact_name || "Unbekannt";
    const eventDate = inquiry.preferred_date || "Kein Datum";
    const guestCount = inquiry.guest_count || "?";
    const customerNotes = response?.customer_notes || "Keine Anmerkungen";

    const emailText = `Neue Kundenantwort auf Angebot

Kunde: ${customerName}
E-Mail: ${inquiry.email}
Event: ${inquiry.event_type || "Veranstaltung"} am ${eventDate}
Gäste: ${guestCount}

Gewählte Option: ${selectedOptionLabel}
Anmerkungen: ${customerNotes}

→ Angebot jetzt finalisieren:
${supabaseUrl.replace(".supabase.co", "").replace("https://", "https://events-storia.de")}/admin/events/${inquiryId}/edit`;

    // E-Mail senden
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpUser || !smtpPassword) {
      console.error("SMTP credentials not configured");
      return new Response(JSON.stringify({ success: true, emailSent: false, reason: "no SMTP" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationRecipients = [
      "info@events-storia.de",
      "d.speranza@storia-muenchen.de",
    ];

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPassword },
      },
    });

    try {
      await client.send({
        from: `STORIA Events <${smtpUser}>`,
        to: notificationRecipients,
        subject: `Kundenantwort: ${customerName} hat Option gewählt`,
        html: `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${emailText}</div>
</body></html>`,
      });
      await client.close();
      console.log("Notification email sent to:", notificationRecipients.join(", "));
    } catch (smtpError) {
      console.error("SMTP error:", smtpError);
      try { await client.close(); } catch { /* ignore */ }
    }

    // Log in email_delivery_logs
    await supabase.from("email_delivery_logs").insert({
      entity_type: "offer_response",
      entity_id: inquiryId,
      recipient_email: notificationRecipients.join(", "),
      recipient_name: "STORIA Team",
      subject: `Kundenantwort: ${customerName}`,
      provider: "ionos-smtp",
      status: "sent",
      sent_by: "system",
      metadata: { selectedOptionLabel, customerNotes },
    });

    return new Response(JSON.stringify({ success: true, emailSent: true }), {
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
