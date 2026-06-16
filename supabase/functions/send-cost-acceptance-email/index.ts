import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { sendEmailWithFallback } from "../_shared/email-sender.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (cents == null || !Number.isFinite(Number(cents))) return null;
  try {
    return (Number(cents) / 100).toLocaleString("de-DE", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
    });
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${currency || "EUR"}`;
  }
}

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function buildHtml(opts: {
  signerName: string | null;
  signUrl: string;
  offerNumber: string | null;
  eventTitle: string | null;
  eventDate: string | null;
  amountFormatted: string | null;
}): string {
  const greeting = opts.signerName
    ? `Sehr geehrte/r ${escapeHtml(opts.signerName)},`
    : "Sehr geehrte Damen und Herren,";

  const detailsRows: string[] = [];
  if (opts.offerNumber)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">Angebotsnummer</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.offerNumber)}</td></tr>`);
  if (opts.eventTitle)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">Veranstaltung</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.eventTitle)}</td></tr>`);
  if (opts.eventDate)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">Datum</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.eventDate)}</td></tr>`);
  if (opts.amountFormatted)
    detailsRows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666;">Bruttobetrag</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(opts.amountFormatted)}</td></tr>`);

  const detailsTable = detailsRows.length
    ? `<table style="border-collapse:collapse;margin:18px 0;font-size:15px;color:#333;">${detailsRows.join("")}</table>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 32px;">
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      für Ihre Veranstaltung steht die digitale Kostenübernahme zur Unterschrift bereit.
      Sie können sie bequem online prüfen und mit wenigen Klicks rechtssicher unterzeichnen.
    </p>
    ${detailsTable}
    <div style="text-align:center;margin:28px 0;">
      <a href="${escapeHtml(opts.signUrl)}"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                padding:14px 28px;border-radius:12px;font-weight:600;font-size:15px;">
        Kostenübernahme digital unterschreiben
      </a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#666;margin:18px 0 0;">
      Dieser Link ist personenbezogen und sollte nicht weitergeleitet werden.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#666;margin:24px 0 0;">
      Bei Fragen erreichen Sie uns jederzeit unter
      <a href="mailto:info@events-storia.de" style="color:#333;">info@events-storia.de</a>.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
    <p style="font-size:13px;line-height:1.5;color:#333;margin:0;">
      Herzliche Grüße<br/>
      Ihr Team von STORIA Catering &amp; Events
    </p>
    <p style="margin:6px 0 0;font-size:11px;color:#999;letter-spacing:0.18em;text-transform:uppercase;">
      Catering &amp; Events — München
    </p>
  </div>
</body></html>`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const auth = await requireAuth(req);

    const body = await req.json().catch(() => ({} as any));
    const costAcceptanceId = String(body?.cost_acceptance_id ?? "").trim();
    const mode = body?.mode === "resend" ? "resend" : "send";
    if (!costAcceptanceId) return json(400, { error: "cost_acceptance_id fehlt." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: loadErr } = await supabase
      .from("cost_acceptances")
      .select(
        "id, inquiry_id, status, signer_email, signer_name, sign_page_url, sign_page_url_embedded, amount_gross_cents, currency, event_title, event_date, offer_number, sent_at, sent_to, sent_message_id, send_count, last_send_error, webhook_events",
      )
      .eq("id", costAcceptanceId)
      .maybeSingle();

    if (loadErr) return json(500, { error: "Kostenübernahme konnte nicht geladen werden." });
    if (!row) return json(404, { error: "Kostenübernahme nicht gefunden." });

    if (row.status === "signed" || row.status === "signed_pending_pdf") {
      return json(400, { error: "Kostenübernahme ist bereits unterschrieben." });
    }
    if (row.status === "withdrawn")
      return json(400, { error: "Kostenübernahme wurde zurückgezogen und kann nicht versendet werden." });
    if (row.status === "cancelled")
      return json(400, { error: "Kostenübernahme wurde storniert und kann nicht versendet werden." });
    if (row.status === "expired")
      return json(400, { error: "Kostenübernahme ist abgelaufen und kann nicht versendet werden." });

    const signUrl = (row.sign_page_url ?? "").trim();
    if (!signUrl) {
      return json(400, {
        error: "Signatur-Link fehlt. Bitte Kostenübernahme neu erstellen.",
      });
    }

    const signerEmail = (row.signer_email ?? "").trim().toLowerCase();
    if (!signerEmail || !EMAIL_RE.test(signerEmail)) {
      return json(400, { error: "Signer E-Mail-Adresse fehlt oder ist ungültig." });
    }

    const subject = "Kostenübernahme digital unterschreiben – STORIA Catering & Events";
    const html = buildHtml({
      signerName: row.signer_name ?? null,
      signUrl,
      offerNumber: row.offer_number ?? null,
      eventTitle: row.event_title ?? null,
      eventDate: formatDate(row.event_date as any),
      amountFormatted: formatAmount(row.amount_gross_cents as any, row.currency as any),
    });

    const result = await sendEmailWithFallback({
      to: signerEmail,
      subject,
      html,
      replyTo: "info@events-storia.de",
    });

    const nowIso = new Date().toISOString();
    const events = Array.isArray(row.webhook_events) ? [...(row.webhook_events as any[])] : [];

    if (!result.success) {
      const errMsg =
        (result.smtpError || result.resendError || "Versand fehlgeschlagen").slice(0, 500);
      events.push({
        event: "cost_acceptance_email_failed",
        at: nowIso,
        mode,
        error: errMsg,
        actor: auth.email,
      });
      await supabase
        .from("cost_acceptances")
        .update({
          last_send_error: errMsg,
          last_send_error_at: nowIso,
          webhook_events: events,
        })
        .eq("id", row.id);
      return json(502, { error: `E-Mail-Versand fehlgeschlagen: ${errMsg}` });
    }

    const keepStatuses = new Set(["sent", "viewed", "signature_started", "signer_signed"]);
    const nextStatus = keepStatuses.has(row.status as string) ? row.status : "sent";

    events.push({
      event: "cost_acceptance_email_sent",
      at: nowIso,
      to: signerEmail,
      mode,
      provider: result.provider,
      message_id: result.messageId,
      actor: auth.email,
    });

    const { error: updErr } = await supabase
      .from("cost_acceptances")
      .update({
        sent_at: nowIso,
        sent_to: signerEmail,
        sent_message_id: result.messageId,
        send_count: (Number(row.send_count) || 0) + 1,
        last_send_error: null,
        last_send_error_at: null,
        status: nextStatus,
        webhook_events: events,
      })
      .eq("id", row.id);

    if (updErr) {
      console.error("[send-cost-acceptance-email] update failed:", updErr.message);
    }

    // Activity Log (best effort)
    try {
      if (row.inquiry_id) {
        await supabase.from("activity_logs").insert({
          entity_type: "inquiry",
          entity_id: row.inquiry_id,
          action: "cost_acceptance_email_sent",
          actor_email: auth.email,
          metadata: {
            cost_acceptance_id: row.id,
            mode,
            provider: result.provider,
            message_id: result.messageId,
          },
        });
      }
    } catch (e) {
      console.warn("[send-cost-acceptance-email] activity log failed:", (e as Error).message);
    }

    return json(200, {
      success: true,
      provider: result.provider,
      message_id: result.messageId,
      mode,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[send-cost-acceptance-email] error:", (e as Error).message);
    return new Response(JSON.stringify({ error: "Interner Fehler beim Versand." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});