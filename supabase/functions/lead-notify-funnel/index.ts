// Edge Function: lead-notify-funnel
// Phase 1: server-side scoring + auto-reply (Resend, info@events-storia.de)
//          + internal notification (noreply@events-storia.de)
//          + failure logging into lead_notify_failures
// Phase 1.5 (stub, commented): Slack hot-lead alert + Slack failure alert
// Fire-and-forget: must NEVER return 5xx to caller; always 200/4xx with JSON.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
// Phase 1.5 (optional)
const SLACK_ALERTS_WEBHOOK_URL = Deno.env.get("SLACK_ALERTS_WEBHOOK_URL");

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM_AUTOREPLY = "Familie Speranza <info@events-storia.de>";
const FROM_INTERNAL = "Lead-Funnel <noreply@events-storia.de>";
const INTERNAL_TO = "info@events-storia.de";

type LeadRow = {
  id: string;
  intent: string | null;
  occasion: string | null;
  occasion_other: string | null;
  people_bucket: string | null;
  format: string | null;
  date_mode: string | null;
  date_value: string | null;
  date_range: unknown;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lead_score: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source_url: string | null;
};

function scoreLead(l: LeadRow): number {
  let s = 0;
  // people
  switch (l.people_bucket) {
    case "10-20": s += 10; break;
    case "20-50": s += 20; break;
    case "50-100": s += 25; break;
    case "100+": s += 30; break;
  }
  // date
  switch (l.date_mode) {
    case "fixed": s += 25; break;
    case "range": s += 15; break;
    case "flexible": s += 10; break;
    case "open": s += 5; break;
  }
  // occasion
  if (l.occasion && l.occasion !== "other") s += 15;
  else if (l.occasion === "other" && l.occasion_other) s += 10;
  // intent
  switch (l.intent) {
    case "catering": s += 20; break;
    case "location": s += 20; break;
    case "both": s += 25; break;
    case "unsure": s += 10; break;
  }
  return Math.min(100, s);
}

async function logFailure(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  step: string,
  error: string
) {
  try {
    await supabase.from("lead_notify_failures").insert({
      lead_id: leadId,
      step,
      error_message: error.slice(0, 2000),
    });
  } catch (_) {
    // swallow
  }

  // Phase 1.5 stub — Slack failure alert
  // if (SLACK_ALERTS_WEBHOOK_URL) {
  //   try {
  //     await fetch(SLACK_ALERTS_WEBHOOK_URL, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         text: `⚠️ Mail failed for lead ${leadId} — step: ${step}`,
  //       }),
  //     });
  //   } catch (_) { /* swallow */ }
  // }
}

async function sendResend(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
}) {
  if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
    throw new Error("RESEND_API_KEY or LOVABLE_API_KEY missing");
  }
  const r = await fetch(`${RESEND_GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${txt.slice(0, 500)}`);
}

function fmtPeople(b: string | null) {
  if (!b) return "—";
  return b;
}
function fmtDate(l: LeadRow) {
  if (l.date_mode === "fixed" && l.date_value) return l.date_value;
  if (l.date_mode === "range") {
    try {
      const r = l.date_range as { from?: string; to?: string } | null;
      if (r?.from && r?.to) return `${r.from} – ${r.to}`;
    } catch (_) {}
    return "Zeitraum (flexibel)";
  }
  if (l.date_mode === "flexible") return "Flexibel";
  return "Noch offen";
}
function fmtOccasion(l: LeadRow) {
  if (l.occasion === "other") return l.occasion_other || "Sonstiges";
  return l.occasion || "—";
}
function fullName(l: LeadRow) {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
}

function buildAutoReplyHtml(l: LeadRow): string {
  const name = l.first_name || "zusammen";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
    <p>Liebe/r ${name},</p>
    <p>vielen Dank für Ihre Anfrage bei Familie Speranza. Wir haben Ihre Angaben erhalten und melden uns innerhalb eines Werktags persönlich bei Ihnen.</p>
    <p><strong>Ihre Anfrage im Überblick:</strong><br>
    Anlass: ${fmtOccasion(l)}<br>
    Personen: ${fmtPeople(l.people_bucket)}<br>
    Datum: ${fmtDate(l)}<br>
    Format: ${l.format || "—"}</p>
    <p>Bei Rückfragen erreichen Sie uns unter <a href="mailto:info@events-storia.de">info@events-storia.de</a>.</p>
    <p>Herzliche Grüße<br>Familie Speranza<br>Storia Restaurant &amp; Catering</p>
  </body></html>`;
}

function buildInternalHtml(l: LeadRow, score: number): string {
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#333;font-size:15px;line-height:1.6">
    <h2 style="margin:0 0 12px">Neuer Lead — Score ${score}</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      <tr><td><b>Name</b></td><td>${fullName(l)}</td></tr>
      <tr><td><b>E-Mail</b></td><td>${l.email || "—"}</td></tr>
      <tr><td><b>Telefon</b></td><td>${l.phone || "—"}</td></tr>
      <tr><td><b>Intent</b></td><td>${l.intent || "—"}</td></tr>
      <tr><td><b>Anlass</b></td><td>${fmtOccasion(l)}</td></tr>
      <tr><td><b>Personen</b></td><td>${fmtPeople(l.people_bucket)}</td></tr>
      <tr><td><b>Datum</b></td><td>${fmtDate(l)}</td></tr>
      <tr><td><b>Format</b></td><td>${l.format || "—"}</td></tr>
      <tr><td><b>Notiz</b></td><td>${(l.notes || "").replace(/</g, "&lt;")}</td></tr>
      <tr><td><b>UTM</b></td><td>${[l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || "—"}</td></tr>
      <tr><td><b>Quelle</b></td><td>${l.source_url || "—"}</td></tr>
      <tr><td><b>Lead-ID</b></td><td><code>${l.id}</code></td></tr>
    </table>
  </body></html>`;
}

function subjectForScore(score: number, l: LeadRow): string {
  const base = `${fullName(l)} • ${fmtOccasion(l)} • ${fmtPeople(l.people_bucket)}`;
  if (score >= 70) return `🔥 HOT LEAD (${score}) — ${base}`;
  if (score >= 40) return `Lead (${score}) — ${base}`;
  return `Lead (${score}) — ${base}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let leadId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    leadId = typeof body?.lead_id === "string" ? body.lead_id : null;
    if (!leadId) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: lead, error: fetchErr } = await supabase
      .from("leads_funnel")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchErr || !lead) {
      return new Response(
        JSON.stringify({ error: "lead not found", detail: fetchErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const l = lead as LeadRow;
    const score = scoreLead(l);

    // Persist score
    await supabase
      .from("leads_funnel")
      .update({ lead_score: score, notified_at: new Date().toISOString() })
      .eq("id", l.id);

    // 1) Auto-Reply (only if email present)
    if (l.email) {
      try {
        await sendResend({
          from: FROM_AUTOREPLY,
          to: [l.email],
          subject: "Wir haben Ihre Anfrage erhalten — Familie Speranza",
          html: buildAutoReplyHtml(l),
          reply_to: "info@events-storia.de",
        });
      } catch (e) {
        await logFailure(supabase, l.id, "auto_reply", String((e as Error).message ?? e));
      }
    }

    // 2) Internal notification
    try {
      await sendResend({
        from: FROM_INTERNAL,
        to: [INTERNAL_TO],
        subject: subjectForScore(score, l),
        html: buildInternalHtml(l, score),
        reply_to: l.email || undefined,
      });
    } catch (e) {
      await logFailure(supabase, l.id, "internal_mail", String((e as Error).message ?? e));
    }

    // Phase 1.5 stub — Slack hot-lead alert (block-kit), out of phase 1
    // if (score >= 70 && SLACK_ALERTS_WEBHOOK_URL) {
    //   try {
    //     await fetch(SLACK_ALERTS_WEBHOOK_URL, {
    //       method: "POST",
    //       headers: { "Content-Type": "application/json" },
    //       body: JSON.stringify({
    //         blocks: [
    //           { type: "header", text: { type: "plain_text", text: `🔥 HOT LEAD (${score})` } },
    //           { type: "section", fields: [
    //             { type: "mrkdwn", text: `*Name:*\n${fullName(l)}` },
    //             { type: "mrkdwn", text: `*Anlass:*\n${fmtOccasion(l)}` },
    //             { type: "mrkdwn", text: `*Personen:*\n${fmtPeople(l.people_bucket)}` },
    //             { type: "mrkdwn", text: `*Datum:*\n${fmtDate(l)}` },
    //           ]},
    //           { type: "actions", elements: [
    //             { type: "button", text: { type: "plain_text", text: "In Maestro öffnen" }, url: `https://events-storia.de/admin/leads/${l.id}` }
    //           ]},
    //           { type: "context", elements: [{ type: "mrkdwn", text: `Lead-ID: \`${l.id}\`` }] },
    //         ],
    //       }),
    //     });
    //   } catch (_) { /* swallow */ }
    // }

    return new Response(JSON.stringify({ ok: true, score }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Fire-and-forget — never 5xx to caller
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message ?? e), lead_id: leadId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});