import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_LABEL: Record<string, string> = {
  failed: "Versand fehlgeschlagen",
  bounced: "Abgewiesen (Bounce)",
  complained: "Als Spam markiert",
  suppressed: "Empfänger unterdrückt",
  delayed: "Verzögert",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]!));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { deliveryLogId } = await req.json();
    if (!deliveryLogId) {
      return new Response(JSON.stringify({ error: "deliveryLogId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: log, error: logErr } = await admin
      .from("email_delivery_logs")
      .select("*")
      .eq("id", deliveryLogId)
      .maybeSingle();

    if (logErr || !log) {
      return new Response(JSON.stringify({ error: "log not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotenz
    const metadata = (log.metadata ?? {}) as Record<string, unknown>;
    if (metadata.alert_sent_at || metadata.resolved_at) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inquiry-Kontext laden
    let inquiryTitle = "Unbekannter Vorgang";
    let inquiryNumber = "";
    let customerName = "";
    let inquiryUrl = `https://events-storia.de/admin`;

    if (log.entity_id) {
      const { data: ev } = await admin
        .from("v2_events")
        .select("id, booking_number, customer_id, date, occasion")
        .eq("id", log.entity_id)
        .maybeSingle();
      if (ev) {
        inquiryNumber = ev.booking_number ?? "";
        inquiryTitle = ev.occasion || "Anfrage";
        inquiryUrl = `https://events-storia.de/admin/inquiries/${ev.id}/edit`;
        if (ev.customer_id) {
          const { data: cust } = await admin
            .from("v2_customers")
            .select("name, company")
            .eq("id", ev.customer_id)
            .maybeSingle();
          if (cust) customerName = cust.company || cust.name || "";
        }
      }
    }

    const statusLabel = STATUS_LABEL[log.status] || log.status;
    const sentAt = new Date(log.sent_at).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const subject = `🚨 DRINGEND: Email an ${log.recipient_email} nicht zugestellt (${statusLabel})`;

    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1a1a1a;">
  <div style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:#dc2626;color:#ffffff;padding:20px 28px;">
      <div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">DRINGEND · Email-Zustellfehler</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px;">${escapeHtml(statusLabel)}</div>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
        Eine Email an einen Kunden konnte <strong>nicht zugestellt</strong> werden. Bitte sofort prüfen und ggf. über einen alternativen Kanal (Telefon, WhatsApp) Kontakt aufnehmen.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#666;width:140px;">Empfänger</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(log.recipient_email)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Original-Betreff</td><td style="padding:8px 0;">${escapeHtml(log.subject || "—")}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Status</td><td style="padding:8px 0;"><span style="display:inline-block;background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:999px;font-weight:600;font-size:12px;">${escapeHtml(statusLabel)}</span></td></tr>
        <tr><td style="padding:8px 0;color:#666;">Provider</td><td style="padding:8px 0;">${escapeHtml(log.provider)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Zeitpunkt</td><td style="padding:8px 0;">${escapeHtml(sentAt)}</td></tr>
        ${customerName ? `<tr><td style="padding:8px 0;color:#666;">Kunde</td><td style="padding:8px 0;">${escapeHtml(customerName)}</td></tr>` : ""}
        ${inquiryNumber ? `<tr><td style="padding:8px 0;color:#666;">Vorgang</td><td style="padding:8px 0;font-family:monospace;">${escapeHtml(inquiryNumber)}</td></tr>` : ""}
        ${log.error_message ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;">Fehlermeldung</td><td style="padding:8px 0;font-family:monospace;font-size:12px;color:#991b1b;">${escapeHtml(String(log.error_message))}</td></tr>` : ""}
      </table>

      <div style="margin-top:28px;">
        <a href="${inquiryUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px;">Vorgang in Maestro öffnen</a>
      </div>

      <p style="margin:24px 0 0;padding:16px;background:#fef3c7;border-left:3px solid #f59e0b;font-size:13px;color:#78350f;border-radius:6px;">
        <strong>Empfehlung:</strong> Kunde innerhalb der nächsten 30 Minuten telefonisch oder per WhatsApp informieren. Im Vorgang den Fehler-Banner als „Erledigt" markieren, sobald der Kunde erreicht wurde.
      </p>
    </div>
    <div style="background:#fafafa;padding:16px 28px;font-size:11px;color:#888;border-top:1px solid #e5e5e5;">
      STORIA Events · Automatischer Maestro-Alarm · ${escapeHtml(new Date().toISOString())}
    </div>
  </div>
</body></html>`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY missing");

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "STORIA Maestro Alarm <info@events-storia.de>",
        to: ["info@events-storia.de"],
        subject,
        html,
        headers: { "X-Entity-Ref-ID": String(deliveryLogId) },
      }),
    });

    if (!sendRes.ok) {
      const body = await sendRes.text();
      console.error("Resend alert send failed:", sendRes.status, body);
      return new Response(JSON.stringify({ error: "alert send failed", body }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotenz-Marker setzen
    await admin
      .from("email_delivery_logs")
      .update({
        metadata: { ...metadata, alert_sent_at: new Date().toISOString() },
      })
      .eq("id", deliveryLogId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-email-failure error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});