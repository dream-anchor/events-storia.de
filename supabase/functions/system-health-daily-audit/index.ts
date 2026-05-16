import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Project = "events_storia" | "ristorante_storia";
const PROJECTS: Project[] = ["events_storia", "ristorante_storia"];
const PROJECT_LABEL: Record<Project, string> = {
  events_storia: "events-storia.de",
  ristorante_storia: "ristorantestoria.de",
};

interface ErrorRow {
  id: string;
  project: Project;
  source: string;
  severity: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
}

interface ProjectSummary {
  project: Project;
  newCritical: ErrorRow[];
  escalating: ErrorRow[];
  staleCritical: ErrorRow[];
  topByCount: ErrorRow[];
  totalUnresolved: number;
}

function renderTable(title: string, rows: ErrorRow[]): string {
  if (!rows.length) return "";
  const items = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:Inter,sans-serif;font-size:13px;color:#171717;">
            <div style="font-weight:600;">${escapeHtml(r.source)}</div>
            <div style="color:#737373;font-size:12px;margin-top:2px;">${escapeHtml(r.message.slice(0, 140))}</div>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:Inter,sans-serif;font-size:13px;color:#171717;text-align:right;white-space:nowrap;">
            ${r.count}× · ${r.severity}
          </td>
        </tr>`,
    )
    .join("");
  return `
    <h3 style="font-family:Inter,sans-serif;font-size:14px;color:#171717;margin:20px 0 8px;">${escapeHtml(title)}</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      ${items}
    </table>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEmail(summaries: ProjectSummary[]): string {
  const blocks = summaries
    .map((s) => {
      const has =
        s.newCritical.length || s.escalating.length || s.staleCritical.length || s.topByCount.length;
      if (!has) return "";
      return `
        <div style="margin:24px 0;">
          <h2 style="font-family:Inter,sans-serif;font-size:16px;color:#171717;margin:0 0 8px;border-bottom:2px solid #171717;padding-bottom:6px;">
            ${escapeHtml(PROJECT_LABEL[s.project])}
          </h2>
          <p style="font-family:Inter,sans-serif;font-size:12px;color:#737373;margin:4px 0 12px;">${s.totalUnresolved} offene Fehler insgesamt</p>
          ${renderTable("Neue kritische Fehler (24h)", s.newCritical)}
          ${renderTable("Eskalierende Fehler (24h, >10 neue Vorfälle)", s.escalating)}
          ${renderTable("Stille kritische Alt-Fehler (>7 Tage offen)", s.staleCritical)}
          ${renderTable("Top 3 nach Häufigkeit (24h)", s.topByCount)}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#fafafa;font-family:Inter,sans-serif;">
  <div style="max-width:680px;margin:0 auto;background:#fff;padding:32px;border-radius:16px;border:1px solid #e5e5e5;">
    <h1 style="font-family:Inter,sans-serif;font-size:20px;color:#171717;margin:0 0 4px;">System-Health · Tägliche Übersicht</h1>
    <p style="font-family:Inter,sans-serif;font-size:13px;color:#737373;margin:0 0 16px;">Zeitfenster: letzte 24 Stunden · ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</p>
    ${blocks}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;">
      <a href="https://events-storia.de/admin/system-health" style="display:inline-block;padding:10px 20px;background:#171717;color:#fff;text-decoration:none;border-radius:12px;font-family:Inter,sans-serif;font-size:13px;">Admin · System-Health öffnen</a>
    </div>
    <p style="font-family:Inter,sans-serif;font-size:11px;color:#a3a3a3;margin:24px 0 0;">Automatisch generiert vom Maestro Health-Audit · info@events-storia.de</p>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let triggeredBy = "cron";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.triggered_by) triggeredBy = String(body.triggered_by);
  } catch {}

  const windowHours = 24;
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  const staleCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const summaries: ProjectSummary[] = [];

  for (const project of PROJECTS) {
    const { data: allUnresolved } = await supabase
      .from("system_errors")
      .select("id,project,source,severity,message,count,first_seen,last_seen,resolved_at")
      .eq("project", project)
      .is("resolved_at", null);

    const rows = (allUnresolved ?? []) as ErrorRow[];

    const newCritical = rows.filter((r) => r.severity === "critical" && r.first_seen >= since);
    const escalating = rows.filter(
      (r) => r.severity !== "warning" && r.last_seen >= since && r.count > 10 && r.first_seen < since,
    );
    const staleCritical = rows.filter(
      (r) => r.severity === "critical" && r.first_seen < staleCutoff,
    );
    const topByCount = [...rows]
      .filter((r) => r.last_seen >= since)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    summaries.push({
      project,
      newCritical,
      escalating,
      staleCritical,
      topByCount,
      totalUnresolved: rows.length,
    });
  }

  const hasSomething = summaries.some(
    (s) => s.newCritical.length || s.escalating.length || s.staleCritical.length || s.topByCount.length,
  );
  const hadBlockers = summaries.some((s) => s.newCritical.length > 0 || s.staleCritical.length > 0);

  const summaryJson = {
    projects: summaries.map((s) => ({
      project: s.project,
      new_critical: s.newCritical.length,
      escalating: s.escalating.length,
      stale_critical: s.staleCritical.length,
      top_count: s.topByCount.length,
      total_unresolved: s.totalUnresolved,
    })),
  };

  let emailSent = false;
  let emailId: string | null = null;
  let emailError: string | null = null;

  if (hasSomething) {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      emailError = "RESEND_API_KEY missing";
    } else {
      const subject = `[System-Health] ${summaries.reduce((a, s) => a + s.newCritical.length, 0)} neu kritisch · ${summaries.reduce((a, s) => a + s.escalating.length, 0)} eskalierend`;
      const html = renderEmail(summaries);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Maestro System-Health <info@events-storia.de>",
            to: ["info@events-storia.de"],
            subject,
            html,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          emailSent = true;
          emailId = json?.id ?? null;
        } else {
          emailError = JSON.stringify(json).slice(0, 500);
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  const { data: runRow } = await supabase
    .from("system_health_audit_runs")
    .insert({
      window_hours: windowHours,
      summary: { ...summaryJson, has_content: hasSomething, email_error: emailError },
      email_sent: emailSent,
      email_id: emailId,
      had_blockers: hadBlockers,
      triggered_by: triggeredBy,
    })
    .select("id,run_at")
    .single();

  return new Response(
    JSON.stringify({
      ok: true,
      run_id: runRow?.id ?? null,
      run_at: runRow?.run_at ?? null,
      has_content: hasSomething,
      had_blockers: hadBlockers,
      email_sent: emailSent,
      email_id: emailId,
      email_error: emailError,
      summary: summaryJson,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});