// Edge Function: purge-retention
// SAFETY: This function ONLY supports mode='dry' in this build.
// It reads candidate views, writes an audit row, and returns counts.
// It NEVER deletes data. Soft/Hard delete will be added in a later, separately approved build
// once retention windows are signed off by Speranza GmbH / DSB and backup/restore is verified.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Scope =
  | "inquiry_non_converted"
  | "inquiry_declined"
  | "email_delivery_logs"
  | "inquiry_attachments"
  | "ai_conversations";

const SCOPE_TO_VIEW: Record<Scope, { view: string; idColumn: string }> = {
  inquiry_non_converted: { view: "v_purge_candidates_inquiry", idColumn: "event_id" },
  inquiry_declined: { view: "v_purge_candidates_inquiry", idColumn: "event_id" },
  email_delivery_logs: { view: "v_purge_candidates_email_logs", idColumn: "id" },
  inquiry_attachments: { view: "v_purge_candidates_attachments", idColumn: "id" },
  ai_conversations: { view: "v_purge_candidates_ai_conversations", idColumn: "id" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const scope = body?.scope as Scope | undefined;
    const mode = (body?.mode ?? "dry") as string;
    const limit = Math.min(Math.max(Number(body?.limit ?? 500), 1), 5000);

    if (!scope || !(scope in SCOPE_TO_VIEW)) {
      return json({ error: "invalid_scope", allowed: Object.keys(SCOPE_TO_VIEW) }, 400);
    }
    if (mode !== "dry") {
      return json({ error: "only_dry_run_supported_in_this_build", received: mode }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load policy (must exist; respect enabled+dry_run flags only for hard/soft — dry always allowed)
    const { data: policy, error: policyErr } = await supabase
      .from("data_retention_policies")
      .select("*")
      .eq("scope", scope)
      .maybeSingle();
    if (policyErr) throw policyErr;
    if (!policy) return json({ error: "policy_not_found", scope }, 404);

    const { view, idColumn } = SCOPE_TO_VIEW[scope];

    // Optional age filter — only apply if soft_delete_after_days is configured
    let query = supabase.from(view).select(`${idColumn}, age_days`).limit(limit);
    if (policy.soft_delete_after_days != null) {
      query = query.gte("age_days", policy.soft_delete_after_days);
    }
    const { data: candidates, error: candErr } = await query;
    if (candErr) throw candErr;

    const ids = (candidates ?? []).map((r: any) => r[idColumn]);

    const { data: audit, error: auditErr } = await supabase
      .from("data_purge_audit")
      .insert({
        policy_id: policy.id,
        scope,
        mode: "dry",
        candidate_count: ids.length,
        affected_count: 0,
        candidate_ids: ids,
        status: "ok",
        triggered_by: req.headers.get("x-triggered-by") ?? "manual",
        finished_at: new Date().toISOString(),
        details: {
          view,
          limit,
          soft_delete_after_days: policy.soft_delete_after_days,
          hard_delete_after_days: policy.hard_delete_after_days,
          enabled: policy.enabled,
          dry_run: policy.dry_run,
          note: "dry-run only — no rows deleted",
        },
      })
      .select()
      .single();
    if (auditErr) throw auditErr;

    await supabase
      .from("data_retention_policies")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_mode: "dry",
        last_run_candidate_count: ids.length,
      })
      .eq("id", policy.id);

    return json({
      ok: true,
      mode: "dry",
      scope,
      candidate_count: ids.length,
      audit_id: audit.id,
      sample_ids: ids.slice(0, 10),
    });
  } catch (err) {
    console.error("purge-retention error", err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}