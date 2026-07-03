// ════════════════════════════════════════════════════════════════════════════
// EXPORT CUSTOMER DATA — Betroffenenrecht auf Auskunft/Datenübertragbarkeit
// (Art. 15 / Art. 20 DSGVO)
//
// Admin-only. Sammelt ALLE personenbezogenen Daten zu einer v2_customers.id
// (inkl. per Merge zusammengeführter Duplikate) und gibt sie als strukturiertes
// JSON zurück, damit ein Admin sie an die betroffene Person weiterleiten kann.
//
// Diese Function verändert KEINE Daten. Der Zugriff wird zu Audit-Zwecken in
// activity_logs protokolliert (entity_type = 'v2_customer', action = 'gdpr_export').
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { loadGdprCustomerGraph, summarizeGraph } from "../_shared/gdpr-customer.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (auth.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin-Rechte erforderlich (Art. 15/20 DSGVO Export)" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const customerId = typeof body?.customerId === "string" ? body.customerId : "";
    if (!UUID_RE.test(customerId)) {
      return new Response(JSON.stringify({ error: "customerId (UUID) erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const graph = await loadGdprCustomerGraph(admin, customerId);
    if (!graph) {
      return new Response(JSON.stringify({ error: "Kunde nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exportedAt = new Date().toISOString();

    // Audit: wer hat wann eine Auskunft für welchen Kunden exportiert.
    try {
      await admin.from("activity_logs").insert({
        entity_type: "v2_customer",
        entity_id: customerId,
        action: "gdpr_export",
        actor_id: auth.userId,
        actor_email: auth.email,
        metadata: {
          exported_at: exportedAt,
          summary: summarizeGraph(graph),
        },
      });
    } catch (auditErr) {
      // Audit-Fehler dürfen den Export selbst nicht verhindern, aber sichtbar sein.
      console.error("[export-customer-data] audit log failed", auditErr);
    }

    return new Response(
      JSON.stringify({
        meta: {
          legal_basis: "Art. 15 / Art. 20 DSGVO",
          exported_at: exportedAt,
          exported_by: auth.email,
          customer_id: customerId,
          note_merged_duplicates: graph.customers.length > 1
            ? "Enthält Daten zusammengeführter Duplikat-Datensätze (merged_into_id)."
            : null,
          note_not_included:
            "Signierte PDF-Dokumente (Kostenübernahmen) und Foto-Dateien in Storage sind " +
            "hier nur als Referenz (Pfad/Hash) enthalten, nicht als Binärinhalt. " +
            "review_request_unsubscribes und activity_logs werden nur informativ mitgeliefert.",
        },
        summary: summarizeGraph(graph),
        data: {
          customers: graph.customers,
          events: graph.events,
          offer_options: graph.offerOptions,
          payments: graph.payments,
          event_changelog: graph.changelog,
          event_comments: graph.comments,
          event_tasks: graph.tasks,
          offer_history: graph.offerHistory,
          event_emails: graph.eventEmails,
          cost_acceptances: graph.costAcceptances,
          balance_payment_links: graph.balancePaymentLinks,
          review_request_log: graph.reviewRequestLog,
          email_delivery_logs: graph.emailDeliveryLogs,
          event_email_links: graph.eventEmailLinks,
          inbox_emails: graph.inboxEmails,
          inquiry_attachments: graph.inquiryAttachments,
          ai_conversations: graph.aiConversations,
          ai_messages: graph.aiMessages,
          ai_extractions: graph.aiExtractions,
          customer_profile: graph.customerProfile,
          vouchers: graph.vouchers,
          review_request_unsubscribe_entry: graph.reviewUnsubscribe,
          activity_log_entries: graph.activityLogs,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    console.error("[export-customer-data] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
