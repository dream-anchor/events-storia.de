import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Body {
  event_email_id?: string;
  reason?: string;
}

/**
 * Re-sends an outbound v2_event_emails row via IONOS SMTP.
 * Triggered by receive-resend-webhook when Resend reports
 * bounced / complained / failed / suppressed for the original send.
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event_email_id, reason } = (await req.json()) as Body;
    if (!event_email_id) {
      return new Response(JSON.stringify({ error: "event_email_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: row, error } = await supabase
      .from("v2_event_emails")
      .select("*")
      .eq("id", event_email_id)
      .maybeSingle();

    if (error || !row) {
      return new Response(JSON.stringify({ error: "email row not found", details: error?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if an SMTP retry already exists for this Resend message
    if (row.resend_message_id) {
      const { data: existing } = await supabase
        .from("email_delivery_logs")
        .select("id")
        .eq("provider", "ionos_smtp_retry")
        .contains("metadata", { original_resend_message_id: row.resend_message_id })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ skipped: true, reason: "smtp retry already attempted" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const smtpUser = Deno.env.get("SMTP_USER")?.trim();
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ error: "SMTP not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = (row.to_email || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const cc = row.cc_email ? row.cc_email.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;
    const bcc = row.bcc_email ? row.bcc_email.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.ionos.de",
        port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
        tls: true,
        auth: { username: smtpUser, password: smtpPassword },
      },
    });

    let sent = false;
    let smtpError: string | null = null;
    try {
      await client.send({
        from: `STORIA Events <${smtpUser}>`,
        to,
        cc,
        bcc,
        subject: row.subject || "Ihr Angebot von STORIA Events",
        html: row.body_html || row.body_text || "",
        replyTo: "info@events-storia.de",
        inReplyTo: row.in_reply_to || undefined,
      });
      await client.close();
      sent = true;
    } catch (e) {
      smtpError = e instanceof Error ? e.message : "SMTP error";
      console.error("SMTP retry failed:", smtpError);
    }

    // Log the retry attempt
    await supabase.from("email_delivery_logs").insert({
      entity_type: "v2_event",
      entity_id: row.event_id,
      recipient_email: row.to_email,
      recipient_name: null,
      subject: row.subject,
      provider: "ionos_smtp_retry",
      provider_message_id: sent ? `smtp-retry-${crypto.randomUUID()}` : null,
      status: sent ? "sent" : "failed",
      error_message: smtpError,
      metadata: {
        email_type: "smtp_fallback_retry",
        original_resend_message_id: row.resend_message_id,
        original_event_email_id: row.id,
        reason: reason || null,
      },
    });

    // Activity log entry so the timeline shows the fallback
    await supabase.from("activity_logs").insert({
      entity_type: "v2_event",
      entity_id: row.event_id,
      action: sent ? "email_smtp_fallback_sent" : "email_smtp_fallback_failed",
      actor_email: "system",
      metadata: {
        recipient: row.to_email,
        subject: row.subject,
        reason: reason || null,
        original_resend_message_id: row.resend_message_id,
        error: smtpError,
      },
    });

    return new Response(JSON.stringify({ success: sent, error: smtpError }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resend-via-smtp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});