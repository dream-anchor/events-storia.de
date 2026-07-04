// Edge Function: purge-retention
//
// SICHERHEITS-DESIGN (siehe PR-Beschreibung "SCHARFSCHALTUNG"):
//   - mode="dry" ist IMMER erlaubt und verändert nie Daten.
//   - mode="hard" (echte Löschung) ist nur erreichbar, wenn ALLE Bedingungen
//     gleichzeitig zutreffen:
//       1) env PURGE_DRY_RUN !== "false"   → Default TRUE (Dry-Run erzwungen).
//          Nur ein *expliziter* "false" hebt die globale Sperre auf.
//       2) die jeweilige Scope-Policy (data_retention_policies) hat
//          enabled = true UND dry_run = false.
//       3) der Aufruf selbst fordert mode="hard" an.
//     Fehlt eine Bedingung, bleibt der Lauf ein Dry-Run (mit Hinweis in der
//     Antwort), bzw. wird mit einem Fehler abgelehnt.
//   - mode="soft" ist (noch) nicht implementiert — es gibt aktuell keine
//     Soft-Delete-Infrastruktur (z.B. deleted_at-Spalten) für die betroffenen
//     Tabellen. Ein Aufruf mit mode="soft" wird explizit abgelehnt statt
//     stillschweigend etwas anderes zu tun.
//   - Zusätzliche Zugriffskontrolle: nur Admins dürfen diese Function
//     überhaupt aufrufen (vorher: keine Auth-Prüfung im Code — siehe Audit-
//     Befund). Das ist unabhängig vom PURGE_DRY_RUN-Schalter und verhindert,
//     dass irgendjemand mit einem gültigen Supabase-JWT den Lauf auslöst.
//   - Alle Scopes hier betreffen ausschließlich NICHT konvertierte / nicht
//     bezahlte Datensätze (die Kandidaten-Views schließen Events mit
//     Rechnung/Zahlung/Kostenübernahme bereits aus). Zusätzlich wird bei
//     echter Löschung defensiv erneut geprüft (siehe assertNoAccountingLinks)
//     und ein Datensatz mit Buchhaltungsbezug NIE hart gelöscht, selbst wenn
//     er fälschlich als Kandidat auftauchen sollte.
//
// Es gibt (noch) KEINEN Cron-Trigger für diese Function — siehe Migration
// supabase/migrations/20260703120000_purge_retention_cron_prepared.sql:
// dort ist ein pg_cron-Aufruf vorbereitet, aber bewusst vollständig
// auskommentiert ("erst nach Freigabe scharfschalten").
//
// Einzel-Kunden-Löschung/Anonymisierung (Art. 17 DSGVO) läuft NICHT über
// diese Function, sondern über delete-customer-data (siehe dort) — dort auch
// die Anonymisierung buchhaltungspflichtiger Daten statt Hard-Delete.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";

type Scope =
  | "inquiry_non_converted"
  | "inquiry_declined"
  | "email_delivery_logs"
  | "inquiry_attachments"
  | "ai_conversations";

type Mode = "dry" | "soft" | "hard";

const SCOPE_TO_VIEW: Record<Scope, { view: string; idColumn: string }> = {
  inquiry_non_converted: { view: "v_purge_candidates_inquiry", idColumn: "event_id" },
  inquiry_declined: { view: "v_purge_candidates_inquiry", idColumn: "event_id" },
  email_delivery_logs: { view: "v_purge_candidates_email_logs", idColumn: "id" },
  inquiry_attachments: { view: "v_purge_candidates_attachments", idColumn: "id" },
  ai_conversations: { view: "v_purge_candidates_ai_conversations", idColumn: "id" },
};

/** Scopes, die (indirekt über v2_events) buchhaltungspflichtige Daten
 *  berühren könnten und daher vor Hard-Delete erneut defensiv geprüft
 *  werden. */
const EVENT_BACKED_SCOPES: Scope[] = ["inquiry_non_converted", "inquiry_declined"];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("PURGE_CRON_SECRET");
    const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    let auth: { email: string; role: string } = { email: "cron@system", role: "admin" };
    if (!isCron) {
      const authed = await requireAuth(req);
      if (authed.role !== "admin") {
        return json({ error: "Admin-Rechte erforderlich" }, 403, corsHeaders);
      }
      auth = authed;
    }

    const body = await req.json().catch(() => ({}));
    const scope = body?.scope as Scope | undefined;
    const requestedMode = (body?.mode ?? "dry") as Mode;
    const limit = Math.min(Math.max(Number(body?.limit ?? 500), 1), 5000);

    if (!scope || !(scope in SCOPE_TO_VIEW)) {
      return json({ error: "invalid_scope", allowed: Object.keys(SCOPE_TO_VIEW) }, 400, corsHeaders);
    }
    if (!["dry", "soft", "hard"].includes(requestedMode)) {
      return json({ error: "invalid_mode", allowed: ["dry", "soft", "hard"] }, 400, corsHeaders);
    }
    if (requestedMode === "soft") {
      return json(
        { error: "soft_delete_not_implemented", note: "Keine Soft-Delete-Infrastruktur vorhanden (v1)." },
        400,
        corsHeaders,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: policy, error: policyErr } = await supabase
      .from("data_retention_policies")
      .select("*")
      .eq("scope", scope)
      .maybeSingle();
    if (policyErr) throw policyErr;
    if (!policy) return json({ error: "policy_not_found", scope }, 404, corsHeaders);

    // ── Gate 1: globaler Notaus-Schalter. Default TRUE (Dry-Run erzwungen). ──
    const globalDryRunLocked = Deno.env.get("PURGE_DRY_RUN") !== "false";

    let mode: Mode = requestedMode;
    let downgradeReason: string | null = null;

    if (requestedMode === "hard") {
      if (globalDryRunLocked) {
        mode = "dry";
        downgradeReason = "PURGE_DRY_RUN ist nicht explizit auf 'false' gesetzt (Default-Schutz aktiv).";
      } else if (!policy.enabled || policy.dry_run) {
        return json(
          {
            error: "scope_not_enabled_for_hard_delete",
            scope,
            enabled: policy.enabled,
            dry_run: policy.dry_run,
            note: "Policy muss enabled=true und dry_run=false haben, bevor hard-delete möglich ist.",
          },
          400,
          corsHeaders,
        );
      }
    }

    const { view, idColumn } = SCOPE_TO_VIEW[scope];

    let query = supabase.from(view).select(`${idColumn}, age_days`).limit(limit);
    const cutoffDays = policy.hard_delete_after_days;
    if (cutoffDays == null) {
      query = query.gte("age_days", 2147483647); // fail-safe: ohne Frist nichts
    } else {
      query = query.gte("age_days", cutoffDays);
    }
    const { data: candidates, error: candErr } = await query;
    if (candErr) throw candErr;

    let ids: string[] = (candidates ?? []).map(
      (r: Record<string, unknown>) => r[idColumn] as string,
    );

    let skippedAccountingLinked: string[] = [];
    let deletionDetails: Record<string, unknown> = {};

    if (mode === "hard") {
      if (EVENT_BACKED_SCOPES.includes(scope)) {
        const verified = await assertNoAccountingLinks(supabase, ids);
        ids = verified.safeIds;
        skippedAccountingLinked = verified.skippedIds;
      }
      deletionDetails = await performHardDelete(supabase, scope, ids);
    }

    const { data: audit, error: auditErr } = await supabase
      .from("data_purge_audit")
      .insert({
        policy_id: policy.id,
        scope,
        mode,
        candidate_count: ids.length,
        affected_count: mode === "hard" ? ids.length : 0,
        candidate_ids: ids,
        status: "ok",
        triggered_by: auth.email,
        finished_at: new Date().toISOString(),
        details: {
          view,
          limit,
          soft_delete_after_days: policy.soft_delete_after_days,
          hard_delete_after_days: policy.hard_delete_after_days,
          enabled: policy.enabled,
          dry_run: policy.dry_run,
          requested_mode: requestedMode,
          executed_mode: mode,
          downgrade_reason: downgradeReason,
          skipped_accounting_linked: skippedAccountingLinked,
          deletion_details: deletionDetails,
          note: mode === "dry" ? "dry-run — keine Zeilen verändert" : "hard-delete ausgeführt",
        },
      })
      .select()
      .single();
    if (auditErr) throw auditErr;

    await supabase
      .from("data_retention_policies")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_mode: mode,
        last_run_candidate_count: ids.length,
      })
      .eq("id", policy.id);

    return json(
      {
        ok: true,
        mode,
        downgrade_reason: downgradeReason,
        scope,
        candidate_count: ids.length,
        skipped_accounting_linked_count: skippedAccountingLinked.length,
        audit_id: audit.id,
        sample_ids: ids.slice(0, 10),
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: err.message }, err.status, getCorsHeaders(req));
    }
    console.error("purge-retention error", err);
    return json({ error: String((err as Error).message ?? err) }, 500, getCorsHeaders(req));
  }
});

/**
 * Defensive Re-Prüfung direkt vor dem Hard-Delete: schließt Event-IDs aus,
 * die (trotz Kandidaten-View) einen Bezug zu Rechnung/Zahlung/Kostenübernahme
 * haben. Diese werden NIE hart gelöscht — für sie greift stattdessen die
 * Anonymisierung in delete-customer-data (Einzelkunden-Fall) bzw. sie
 * bleiben schlicht bestehen, bis sie über einen anderen Weg bereinigt sind.
 */
async function assertNoAccountingLinks(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<{ safeIds: string[]; skippedIds: string[] }> {
  if (eventIds.length === 0) return { safeIds: [], skippedIds: [] };

  const [eventsRes, paymentsRes, costAcceptancesRes, balanceLinksRes] = await Promise.all([
    supabase.from("v2_events").select("id, invoice_lexoffice_id, lexoffice_quotation_id").in(
      "id",
      eventIds,
    ),
    supabase.from("v2_payments").select("event_id").in("event_id", eventIds),
    supabase.from("cost_acceptances").select("inquiry_id").in("inquiry_id", eventIds),
    supabase.from("balance_payment_links").select("event_id").in("event_id", eventIds),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (costAcceptancesRes.error) throw costAcceptancesRes.error;
  if (balanceLinksRes.error) throw balanceLinksRes.error;

  const accountingLinked = new Set<string>();
  for (const e of (eventsRes.data ?? []) as Record<string, unknown>[]) {
    if (e.invoice_lexoffice_id || e.lexoffice_quotation_id) accountingLinked.add(e.id as string);
  }
  for (const p of (paymentsRes.data ?? []) as Record<string, unknown>[]) {
    accountingLinked.add(p.event_id as string);
  }
  for (const c of (costAcceptancesRes.data ?? []) as Record<string, unknown>[]) {
    accountingLinked.add(c.inquiry_id as string);
  }
  for (const b of (balanceLinksRes.data ?? []) as Record<string, unknown>[]) {
    if (b.event_id) accountingLinked.add(b.event_id as string);
  }

  const safeIds = eventIds.filter((id) => !accountingLinked.has(id));
  const skippedIds = eventIds.filter((id) => accountingLinked.has(id));
  return { safeIds, skippedIds };
}

/** Führt den tatsächlichen Hard-Delete für einen Scope aus. */
async function performHardDelete(
  supabase: SupabaseClient,
  scope: Scope,
  ids: string[],
): Promise<Record<string, unknown>> {
  if (ids.length === 0) return { deleted: 0 };

  switch (scope) {
    case "inquiry_non_converted":
    case "inquiry_declined": {
      // Kind-Tabellen ohne FK/CASCADE auf v2_events zuerst manuell räumen.
      const { data: attachments } = await supabase
        .from("inquiry_attachments")
        .select("id, storage_bucket, storage_path")
        .in("inquiry_id", ids);
      for (const att of (attachments ?? []) as Record<string, unknown>[]) {
        const bucket = att.storage_bucket as string | undefined;
        const path = att.storage_path as string | undefined;
        if (bucket && path) {
          await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
        }
      }
      if ((attachments ?? []).length > 0) {
        await supabase.from("inquiry_attachments").delete().in(
          "id",
          (attachments ?? []).map((a: Record<string, unknown>) => a.id as string),
        );
      }
      await supabase.from("ai_conversations").delete().in("inquiry_id", ids);

      // Der eigentliche Event-Delete räumt per FK-CASCADE u.a. ab:
      // v2_offer_options, v2_payments (sollten hier ohnehin leer sein),
      // v2_event_changelog, v2_event_comments, v2_event_tasks,
      // v2_event_offer_history, v2_event_emails, cost_acceptances,
      // event_email_links. review_request_log/inbox_emails.suggested_event_id
      // nutzen ON DELETE SET NULL (Zeile bleibt, Referenz wird NULL).
      const { error, count } = await supabase
        .from("v2_events")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) throw error;
      return { deleted: count ?? ids.length };
    }

    case "email_delivery_logs": {
      const { error, count } = await supabase
        .from("email_delivery_logs")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) throw error;
      return { deleted: count ?? ids.length };
    }

    case "inquiry_attachments": {
      const { data: rows } = await supabase
        .from("inquiry_attachments")
        .select("id, storage_bucket, storage_path")
        .in("id", ids);
      for (const att of (rows ?? []) as Record<string, unknown>[]) {
        const bucket = att.storage_bucket as string | undefined;
        const path = att.storage_path as string | undefined;
        if (bucket && path) {
          await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
        }
      }
      const { error, count } = await supabase
        .from("inquiry_attachments")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) throw error;
      return { deleted: count ?? ids.length };
    }

    case "ai_conversations": {
      // ai_messages / ai_extractions haben ON DELETE CASCADE auf ai_conversations.
      const { error, count } = await supabase
        .from("ai_conversations")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) throw error;
      return { deleted: count ?? ids.length };
    }

    default:
      return { deleted: 0, note: "unknown_scope" };
  }
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
