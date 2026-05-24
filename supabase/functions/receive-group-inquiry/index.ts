import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://ristorantestoria.de",
  "https://www.ristorantestoria.de",
  "https://events-storia.de",
  "https://www.events-storia.de",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isLocalhost = origin.startsWith("http://localhost:");
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLocalhost;
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

interface GroupInquiryRequest {
  companyName?: string;
  contactName: string;
  email: string;
  phone?: string;
  groupSize: number;
  preferredDate?: string;
  preferredDateFlexible?: boolean;
  arrivalTime?: string;
  preferredMenu?: string;
  message?: string;
  language?: string;
  source?: string;
}

interface SendResult {
  sent: boolean;
  provider: string;
  messageId: string | null;
  errorMessage: string | null;
}

async function sendEmail(
  to: string[],
  subject: string,
  text: string,
  fromName: string,
  replyTo?: string,
): Promise<SendResult> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim();
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  const htmlBody = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
<div style="white-space: pre-wrap;">${text}</div></body></html>`;

  let sent = false;
  let provider = "";
  let messageId: string | null = null;
  let errorMessage: string | null = null;

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          from: `${fromName} <info@events-storia.de>`,
          to,
          subject,
          html: htmlBody,
          text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        sent = true;
        provider = "resend";
        messageId = data.id || null;
      } else {
        errorMessage = `Resend error: ${await res.text()}`;
        console.error(errorMessage);
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "Resend error";
    }
  }

  if (!sent && smtpUser && smtpPassword) {
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");
      const client = new SMTPClient({
        connection: { hostname: smtpHost, port: smtpPort, tls: true, auth: { username: smtpUser, password: smtpPassword } },
      });
      await client.send({ from: `${fromName} <${smtpUser}>`, to, replyTo, subject, html: htmlBody });
      await client.close();
      sent = true;
      provider = "ionos_smtp";
      errorMessage = null;
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : "SMTP error";
    }
  }

  if (!sent && !resendApiKey && !smtpUser) {
    errorMessage = "No email provider configured";
  }

  return { sent, provider, messageId, errorMessage };
}

function customerText(d: GroupInquiryRequest): string {
  return `STORIA · REISEGRUPPEN

Guten Tag ${d.contactName},

vielen Dank für Ihre Reisegruppen-Anfrage. Wir prüfen Ihre Anfrage und melden uns innerhalb von 24 Stunden mit einem individuellen Angebot.


IHRE ANFRAGE

${d.companyName ? `Firma: ${d.companyName}\n` : ""}Ansprechpartner: ${d.contactName}
E-Mail: ${d.email}
${d.phone ? `Telefon: ${d.phone}\n` : ""}
Gruppengröße: ${d.groupSize}
Wunschtermin: ${d.preferredDate || "Flexibel"}${d.preferredDateFlexible ? " (flexibel)" : ""}
Ankunftszeit: ${d.arrivalTime || "Nicht angegeben"}
Menü-Wunsch: ${d.preferredMenu || "Nicht angegeben"}

${d.message ? `Nachricht:\n${d.message}\n` : ""}

Bei Rückfragen:
Tel: +49 89 51519696
E-Mail: info@events-storia.de

STORIA · Ristorante
Karlstraße 47a · 80333 München
events-storia.de`;
}

function restaurantText(d: GroupInquiryRequest): string {
  const now = new Date().toLocaleString("de-DE", { dateStyle: "full", timeStyle: "short" });
  return `NEUE REISEGRUPPEN-ANFRAGE

Eingegangen: ${now}

KONTAKT
${d.companyName ? `Firma: ${d.companyName}\n` : ""}Name: ${d.contactName}
E-Mail: ${d.email}
${d.phone ? `Telefon: ${d.phone}` : ""}

ANFRAGE
Gruppengröße: ${d.groupSize}
Wunschtermin: ${d.preferredDate || "Flexibel"}${d.preferredDateFlexible ? " (flexibel)" : ""}
Ankunftszeit: ${d.arrivalTime || "n/a"}
Menü-Wunsch: ${d.preferredMenu || "n/a"}
Sprache: ${d.language || "de"}

${d.message ? `NACHRICHT\n${d.message}\n` : ""}

→ Maestro: https://events-storia.de/admin`;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: GroupInquiryRequest = await req.json();

    // Validate required fields
    if (!data.contactName || !data.email || !data.groupSize) {
      return new Response(
        JSON.stringify({ error: "contactName, email und groupSize sind erforderlich" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (typeof data.groupSize !== "number" || data.groupSize < 1) {
      return new Response(
        JSON.stringify({ error: "groupSize muss eine positive Zahl sein" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting: max 5 group-event inquiries per email in 60 minutes
    const email = data.email.toLowerCase().trim();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rlCustomers } = await supabase
      .from("v2_customers")
      .select("id")
      .ilike("email", email);
    const rlIds = (rlCustomers ?? []).map((c: any) => c.id);
    let count = 0;
    if (rlIds.length > 0) {
      const { count: c } = await supabase
        .from("v2_events")
        .select("id", { count: "exact", head: true })
        .eq("service_type", "group")
        .in("customer_id", rlIds)
        .gte("created_at", oneHourAgo);
      count = c ?? 0;
    }

    if (count >= 5) {
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Kunde finden (per E-Mail) oder anlegen
    let customerId: string | null = null;
    {
      const { data: existing } = await supabase
        .from("v2_customers")
        .select("id")
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: created, error: cErr } = await supabase
          .from("v2_customers")
          .insert({
            name: data.contactName || email,
            company: data.companyName || null,
            email,
            phone: data.phone || null,
          })
          .select("id")
          .single();
        if (cErr) throw new Error(`Customer error: ${cErr.message}`);
        customerId = created!.id;
      }
    }

    const { data: inquiry, error: insertError } = await supabase
      .from("v2_events")
      .insert({
        customer_id: customerId,
        status: "inquiry",
        service_type: "group",
        source: "reisegruppen",
        date: data.preferredDate || null,
        event_time: data.arrivalTime || null,
        guest_count: data.groupSize,
        occasion: "Reisegruppe",
        customer_notes: data.message || null,
        language: data.language || "de",
        arrival_time: data.arrivalTime || null,
        preferred_menu: data.preferredMenu || null,
        preferred_date_flexible: data.preferredDateFlexible ?? false,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    const { error: markerError } = await supabase
      .from("v2_events")
      .update({ source_inquiry_id: inquiry.id })
      .eq("id", inquiry.id);

    if (markerError) {
      console.error("Compatibility marker error:", markerError);
      throw new Error(`Database error: ${markerError.message}`);
    }

    console.log("Group inquiry saved:", inquiry.id);

    // ============ Notifications (Kunde + Betreiber + WhatsApp) ============
    const supabaseUrl2 = supabaseUrl;
    const supabaseServiceKey2 = supabaseServiceKey;
    try {
      const custSubject = "Ihre Reisegruppen-Anfrage bei STORIA";
      const custResult = await sendEmail([email], custSubject, customerText(data), "STORIA Reisegruppen");
      await supabase.from("email_delivery_logs").insert({
        entity_type: "v2_event",
        entity_id: inquiry.id,
        recipient_email: email,
        recipient_name: data.contactName,
        subject: custSubject,
        provider: custResult.provider || "none",
        provider_message_id: custResult.messageId,
        status: custResult.sent ? "sent" : "failed",
        error_message: custResult.errorMessage,
        sent_by: "system",
        metadata: { email_type: "group_inquiry_confirmation_customer" },
      });

      const restSubject = `Neue Reisegruppen-Anfrage: ${data.companyName || data.contactName} (${data.groupSize} Pers.)`;
      const restResult = await sendEmail(
        ["info@events-storia.de"],
        restSubject,
        restaurantText(data),
        "STORIA Anfragen",
        data.email,
      );
      await supabase.from("email_delivery_logs").insert({
        entity_type: "v2_event",
        entity_id: inquiry.id,
        recipient_email: "info@events-storia.de",
        recipient_name: "STORIA Team",
        subject: restSubject,
        provider: restResult.provider || "none",
        provider_message_id: restResult.messageId,
        status: restResult.sent ? "sent" : "failed",
        error_message: restResult.errorMessage,
        sent_by: "system",
        metadata: { email_type: "group_inquiry_notification_restaurant" },
      });

      await supabase
        .from("v2_events")
        .update({ notification_sent: custResult.sent && restResult.sent })
        .eq("id", inquiry.id);

      // WhatsApp (fire-and-forget)
      fetch(`${supabaseUrl2}/functions/v1/send-whatsapp-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey2}`,
        },
        body: JSON.stringify({
          type: "new_inquiry",
          customerName: data.contactName,
          customerEmail: data.email,
          eventType: "Reisegruppe",
          guestCount: data.groupSize,
          desiredDate: data.preferredDate || undefined,
          entityType: "v2_event",
          entityId: inquiry.id,
        }),
      }).catch((e) => console.error("WhatsApp alert error:", e));
    } catch (notifyErr) {
      console.error("Notification dispatch failed:", notifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, id: inquiry.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in receive-group-inquiry:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
