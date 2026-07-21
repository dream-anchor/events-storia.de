import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { resolveTenantFromEntity } from "../_shared/tenant.ts";
import {
  queryEsignaturesContract,
  resendEsignaturesSignRequest,
} from "../_shared/esignatures-client.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
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
        "id, inquiry_id, status, signer_email, sign_page_url, esignatures_contract_id, send_count, webhook_events",
      )
      .eq("id", costAcceptanceId)
      .maybeSingle();

    if (loadErr) return json(500, { error: "Kostenübernahme konnte nicht geladen werden." });
    if (!row) return json(404, { error: "Kostenübernahme nicht gefunden." });

    if (row.status === "signed" || row.status === "signed_pending_pdf") {
      return json(400, { error: "Kostenübernahme ist bereits unterschrieben." });
    }
    if (row.status === "withdrawn") {
      return json(400, { error: "Kostenübernahme wurde zurückgezogen und kann nicht versendet werden." });
    }
    if (row.status === "cancelled") {
      return json(400, { error: "Kostenübernahme wurde storniert und kann nicht versendet werden." });
    }
    if (row.status === "expired") {
      return json(400, { error: "Kostenübernahme ist abgelaufen und kann nicht versendet werden." });
    }

    const signUrl = (row.sign_page_url ?? "").trim();
    if (!signUrl) {
      return json(400, { error: "Signatur-Link fehlt. Bitte Kostenübernahme neu erstellen." });
    }

    const contractId = (row.esignatures_contract_id ?? "").trim();
    if (!contractId) {
      return json(400, {
        error: "eSignatures-Vertrags-ID fehlt. Bitte Kostenübernahme neu erstellen.",
      });
    }

    const signerEmail = (row.signer_email ?? "").trim().toLowerCase();
    if (!signerEmail || !EMAIL_RE.test(signerEmail)) {
      return json(400, { error: "Signer E-Mail-Adresse fehlt oder ist ungültig." });
    }

    const eventTenantId = await resolveTenantFromEntity(supabase, "v2_events", row.inquiry_id);
    if (eventTenantId !== auth.tenantId) {
      return json(403, { error: "Kostenübernahme gehört nicht zu Ihrem Mandanten." });
    }

    const nowIso = new Date().toISOString();
    const events = Array.isArray(row.webhook_events) ? [...(row.webhook_events as unknown[])] : [];

    let signerId = "";
    try {
      const { contract } = await queryEsignaturesContract(contractId);
      const signers = Array.isArray(contract?.signers) ? contract.signers : [];
      const signer = signers.find((s: Record<string, unknown>) =>
        String(s?.email ?? "").trim().toLowerCase() === signerEmail ||
        String(s?.sign_page_url ?? "").trim() === signUrl
      ) ?? signers[0];
      signerId = String(signer?.id ?? "").trim();
      if (!signerId) throw new Error("Signer-ID fehlt in der eSignatures-Antwort.");
    } catch (err) {
      const errMsg = ((err as Error).message || "eSignatures-Vertrag konnte nicht gelesen werden.").slice(0, 500);
      events.push({
        event: "cost_acceptance_esignatures_resend_failed",
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
      return json(502, { error: `eSignatures-Versand fehlgeschlagen: ${errMsg}` });
    }

    try {
      await resendEsignaturesSignRequest(contractId, signerId);
    } catch (err) {
      const errMsg = ((err as Error).message || "eSignatures-Versand fehlgeschlagen.").slice(0, 500);
      events.push({
        event: "cost_acceptance_esignatures_resend_failed",
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
      return json(502, { error: `eSignatures-Versand fehlgeschlagen: ${errMsg}` });
    }

    const keepStatuses = new Set(["sent", "viewed", "signature_started", "signer_signed"]);
    const nextStatus = keepStatuses.has(row.status as string) ? row.status : "sent";

    events.push({
      event: "cost_acceptance_esignatures_email_resent",
      at: nowIso,
      to: signerEmail,
      mode,
      provider: "esignatures",
      contract_id: contractId,
      signer_id: signerId,
      actor: auth.email,
    });

    const { error: updErr } = await supabase
      .from("cost_acceptances")
      .update({
        sent_at: nowIso,
        sent_to: signerEmail,
        sent_message_id: null,
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

    try {
      if (row.inquiry_id) {
        await supabase.from("activity_logs").insert({
          entity_type: "event_inquiry",
          entity_id: row.inquiry_id,
          action: "cost_acceptance_email_sent",
          actor_email: auth.email,
          metadata: {
            cost_acceptance_id: row.id,
            mode,
            provider: "esignatures",
            contract_id: contractId,
            signer_id: signerId,
            tenant_id: eventTenantId,
          },
        });
      }
    } catch (e) {
      console.warn("[send-cost-acceptance-email] activity log failed:", (e as Error).message);
    }

    return json(200, {
      success: true,
      provider: "esignatures",
      contract_id: contractId,
      signer_id: signerId,
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