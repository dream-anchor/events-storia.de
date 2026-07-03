// ════════════════════════════════════════════════════════════════════════════
// DELETE CUSTOMER DATA — Betroffenenrecht auf Löschung (Art. 17 DSGVO)
//
// Admin-only. Löscht bzw. anonymisiert ALLE personenbezogenen Daten zu einer
// v2_customers.id (inkl. per Merge zusammengeführter Duplikate).
//
// SICHERHEITS-DESIGN (siehe PR-Beschreibung "SCHARFSCHALTUNG"):
//   - Default ist IMMER eine Vorschau (Preview/Dry-Run): es wird NICHTS
//     verändert, nur zurückgegeben, was betroffen wäre.
//   - Eine echte Ausführung erfordert ALLE drei Bedingungen gleichzeitig:
//       1) env GDPR_ERASURE_ENABLED === "true"   (Master-Schalter, Default AUS)
//       2) body.execute === true                  (expliziter Aufruf-Parameter)
//       3) body.confirm === customerId             (Tippfehler-Schutz)
//   - Fehlt eine Bedingung, bleibt die Function im Preview-Modus — auch wenn
//     execute:true gesendet wurde (mit erklärender Meldung in der Antwort).
//
// LÖSCH-/ANONYMISIERUNGS-PRINZIP:
//   - Events OHNE Bezug zu Rechnung/Zahlung/unterschriebener Kostenübernahme
//     werden HART gelöscht (inkl. referenzierender Kind-Tabellen).
//   - Events MIT Bezug zu Rechnung/Zahlung (HGB/AO-Aufbewahrungspflicht)
//     werden NICHT gelöscht, sondern personenbezogene Felder werden
//     ANONYMISIERT; Beträge/Belegnummern/Daten bleiben für die Buchhaltung
//     erhalten.
//   - Der v2_customers-Datensatz selbst wird nur dann hart gelöscht, wenn nach
//     der Bereinigung KEINE v2_events-Zeile mehr auf ihn verweist (FK-Zwang:
//     v2_events.customer_id ist NOT NULL REFERENCES v2_customers, ohne
//     ON DELETE CASCADE). Andernfalls wird der Kundendatensatz anonymisiert.
//   - Korrespondenz (E-Mails, KI-Chat-Transkripte, Uploads, Kommentare,
//     interne Tasks, Änderungsprotokoll) gilt NICHT als buchhaltungspflichtig
//     und wird in jedem Fall gelöscht/redigiert — auch bei Events, die wegen
//     Zahlung/Rechnung selbst erhalten bleiben.
//
// BEKANNTE GRENZEN (siehe PR-Beschreibung):
//   - Signierte PDF-Dokumente (Kostenübernahmen) in Storage werden NICHT
//     automatisch geschwärzt (nur DB-Felder). Foto-Dateien (photo_album)
//     sind nicht kundenverknüpft und daher hier nicht Teil der Löschung.
//   - Der LexOffice-Kontakt (lexoffice_contact_id) wird NICHT in LexOffice
//     selbst angefasst — nur die DB-seitige Referenz bleibt für
//     Rechnungszuordnung erhalten, solange buchhaltungsrelevante Events
//     existieren.
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import {
  loadGdprCustomerGraph,
  summarizeGraph,
  type GdprCustomerGraph,
} from "../_shared/gdpr-customer.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REDACTED = "[DSGVO-Löschung — Inhalt entfernt]";
const REDACTED_EMAIL_DOMAIN = "anonymisiert.invalid";

function anonymizedEmail(customerId: string): string {
  return `geloescht+${customerId}@${REDACTED_EMAIL_DOMAIN}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (auth.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin-Rechte erforderlich (Art. 17 DSGVO Löschung)" }),
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

    const requestedExecute = body?.execute === true;
    const confirmMatches = body?.confirm === customerId;

    // Master-Schalter — per Default AUS. Muss vor Scharfschaltung bewusst
    // gesetzt werden (siehe PR "SCHARFSCHALTUNG — erst nach Freigabe").
    const erasureEnabledByConfig = Deno.env.get("GDPR_ERASURE_ENABLED") === "true";

    const willExecute = requestedExecute && confirmMatches && erasureEnabledByConfig;
    const blockedReasons: string[] = [];
    if (requestedExecute && !erasureEnabledByConfig) {
      blockedReasons.push(
        "erasure_disabled_by_config (GDPR_ERASURE_ENABLED ist nicht auf 'true' gesetzt)",
      );
    }
    if (requestedExecute && !confirmMatches) {
      blockedReasons.push("confirm stimmt nicht mit customerId überein");
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

    const plan = buildErasurePlan(graph);

    if (!willExecute) {
      // Preview/Dry-Run (Standardfall).
      await writeAudit(admin, {
        mode: "dry",
        customerId,
        graph,
        plan,
        triggeredBy: auth.email,
        affected: null,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "dry",
          note: "Vorschau — es wurde NICHTS verändert.",
          blocked_reasons: blockedReasons.length > 0 ? blockedReasons : undefined,
          summary: summarizeGraph(graph),
          plan,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Echte Ausführung ──────────────────────────────────────────────────
    const result = await executeErasure(admin, graph, plan);

    await writeAudit(admin, {
      mode: "hard",
      customerId,
      graph,
      plan,
      triggeredBy: auth.email,
      affected: result,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "hard",
        summary: summarizeGraph(graph),
        plan,
        result,
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
    console.error("[delete-customer-data] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Planung (auch für Preview genutzt — rein lesend)
// ──────────────────────────────────────────────────────────────────────────

interface ErasurePlan {
  events_to_hard_delete: string[];
  events_to_anonymize: string[];
  customers_to_hard_delete: string[];
  customers_to_anonymize: string[];
  auth_users_to_delete: string[];
}

function buildErasurePlan(graph: GdprCustomerGraph): ErasurePlan {
  const eventsToDelete: string[] = [];
  const eventsToAnonymize: string[] = [];
  for (const e of graph.events) {
    if (graph.accountingRelevantEventIds.has(e.id)) {
      eventsToAnonymize.push(e.id);
    } else {
      eventsToDelete.push(e.id);
    }
  }

  // Kunde kann nur gelöscht werden, wenn NACH der Bereinigung keine Events
  // mehr auf ihn verweisen (FK v2_events.customer_id ohne ON DELETE CASCADE).
  const customersToHardDelete: string[] = [];
  const customersToAnonymize: string[] = [];
  for (const c of graph.customers) {
    const remainingEvents = graph.events.filter(
      (e) => e.customer_id === c.id && eventsToAnonymize.includes(e.id),
    );
    if (remainingEvents.length === 0) {
      customersToHardDelete.push(c.id);
    } else {
      customersToAnonymize.push(c.id);
    }
  }

  const authUsersToDelete = graph.customers
    .map((c) => c.auth_user_id)
    .filter((id): id is string => !!id);

  return {
    events_to_hard_delete: eventsToDelete,
    events_to_anonymize: eventsToAnonymize,
    customers_to_hard_delete: customersToHardDelete,
    customers_to_anonymize: customersToAnonymize,
    auth_users_to_delete: authUsersToDelete,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Ausführung (nur erreichbar, wenn alle drei Gates in Deno.serve erfüllt sind)
// ──────────────────────────────────────────────────────────────────────────

interface ErasureResult {
  events_hard_deleted: number;
  events_anonymized: number;
  customers_hard_deleted: number;
  customers_anonymized: number;
  auth_users_deleted: number;
  inquiry_attachments_deleted: number;
  ai_conversations_deleted: number;
  review_request_log_deleted: number;
  email_delivery_logs_deleted: number;
  event_comments_deleted: number;
  event_tasks_deleted: number;
  event_changelog_deleted: number;
  inbox_emails_redacted: number;
  inbox_emails_left_shared: number;
  event_emails_redacted: number;
  cost_acceptances_anonymized: number;
  offer_options_anonymized: number;
  offer_history_redacted: number;
  payments_notes_cleared: number;
  balance_payment_links_anonymized: number;
  vouchers_anonymized: number;
  errors: string[];
}

async function executeErasure(
  admin: SupabaseClient,
  graph: GdprCustomerGraph,
  plan: ErasurePlan,
): Promise<ErasureResult> {
  const errors: string[] = [];
  const safe = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      const msg = `${label}: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[delete-customer-data]", msg);
      errors.push(msg);
    }
  };

  const allEventIds = graph.eventIds;

  // 1) Immer löschen — Korrespondenz/Betrieb, nicht buchhaltungspflichtig.
  let inquiryAttachmentsDeleted = 0;
  await safe("inquiry_attachments", async () => {
    for (const att of graph.inquiryAttachments) {
      const bucket = att.storage_bucket as string | undefined;
      const path = att.storage_path as string | undefined;
      if (bucket && path) {
        await admin.storage.from(bucket).remove([path]).catch(() => undefined);
      }
    }
    if (graph.inquiryAttachments.length > 0) {
      const ids = graph.inquiryAttachments.map((a) => a.id as string);
      const { error, count } = await admin
        .from("inquiry_attachments")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) throw error;
      inquiryAttachmentsDeleted = count ?? ids.length;
    }
  });

  let aiConversationsDeleted = 0;
  await safe("ai_conversations", async () => {
    if (graph.aiConversations.length > 0) {
      const ids = graph.aiConversations.map((c) => c.id as string);
      // ai_messages / ai_extractions haben ON DELETE CASCADE auf ai_conversations.
      const { error, count } = await admin
        .from("ai_conversations")
        .delete({ count: "exact" })
        .in("id", ids);
      if (error) throw error;
      aiConversationsDeleted = count ?? ids.length;
    }
  });

  let reviewLogDeleted = 0;
  await safe("review_request_log", async () => {
    if (allEventIds.length > 0) {
      const { error, count } = await admin
        .from("review_request_log")
        .delete({ count: "exact" })
        .in("event_id", allEventIds);
      if (error) throw error;
      reviewLogDeleted = count ?? 0;
    }
  });

  let emailDeliveryLogsDeleted = 0;
  await safe("email_delivery_logs", async () => {
    if (allEventIds.length > 0) {
      const { error, count } = await admin
        .from("email_delivery_logs")
        .delete({ count: "exact" })
        .in("entity_id", allEventIds);
      if (error) throw error;
      emailDeliveryLogsDeleted = count ?? 0;
    }
  });

  // Kommentare/Tasks/Changelog explizit löschen — für Events, die gleich
  // hart gelöscht werden, greift zusätzlich die FK-CASCADE automatisch;
  // für anonymisierte (buchhaltungsrelevante) Events bleibt der Event
  // erhalten, daher hier expliziter Delete nötig.
  let commentsDeleted = 0;
  let tasksDeleted = 0;
  let changelogDeleted = 0;
  await safe("v2_event_comments", async () => {
    if (allEventIds.length > 0) {
      const { error, count } = await admin
        .from("v2_event_comments")
        .delete({ count: "exact" })
        .in("event_id", allEventIds);
      if (error) throw error;
      commentsDeleted = count ?? 0;
    }
  });
  await safe("v2_event_tasks", async () => {
    if (allEventIds.length > 0) {
      const { error, count } = await admin
        .from("v2_event_tasks")
        .delete({ count: "exact" })
        .in("event_id", allEventIds);
      if (error) throw error;
      tasksDeleted = count ?? 0;
    }
  });
  await safe("v2_event_changelog", async () => {
    if (allEventIds.length > 0) {
      const { error, count } = await admin
        .from("v2_event_changelog")
        .delete({ count: "exact" })
        .in("event_id", allEventIds);
      if (error) throw error;
      changelogDeleted = count ?? 0;
    }
  });

  // 2) Korrespondenz (inbox_emails / event_email_links) — nur redigieren,
  //    wenn die Rohmail ausschließlich mit Events dieses Kunden verknüpft ist.
  let inboxEmailsRedacted = 0;
  let inboxEmailsLeftShared = 0;
  await safe("inbox_emails", async () => {
    const emailIds = Array.from(
      new Set(graph.eventEmailLinks.map((l) => l.email_id as string)),
    );
    for (const emailId of emailIds) {
      const { data: otherLinks, error: otherErr } = await admin
        .from("event_email_links")
        .select("event_id")
        .eq("email_id", emailId)
        .not("event_id", "in", `(${allEventIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
      if (otherErr) throw otherErr;
      const exclusive = (otherLinks ?? []).length === 0;
      if (exclusive) {
        const { error: updErr } = await admin
          .from("inbox_emails")
          .update({
            subject: REDACTED,
            body_text: REDACTED,
            body_html: null,
            raw_mime: REDACTED,
            from_email: anonymizedEmail(emailId),
            from_name: null,
            to_emails: [],
            cc_emails: [],
            reply_to_email: null,
          })
          .eq("id", emailId);
        if (updErr) throw updErr;
        inboxEmailsRedacted += 1;
      } else {
        inboxEmailsLeftShared += 1;
      }
    }
    // Verknüpfungen zu Events dieses Kunden immer entfernen (bei hart
    // gelöschten Events geschieht das ohnehin per CASCADE).
    if (allEventIds.length > 0) {
      const { error: linkDelErr } = await admin
        .from("event_email_links")
        .delete()
        .in("event_id", allEventIds);
      if (linkDelErr) throw linkDelErr;
    }
  });

  // 3) v2_event_emails — bei buchhaltungsrelevanten (verbleibenden) Events
  //    Inhalt redigieren; bei zu löschenden Events übernimmt CASCADE.
  let eventEmailsRedacted = 0;
  await safe("v2_event_emails", async () => {
    if (plan.events_to_anonymize.length > 0) {
      const { error, count } = await admin
        .from("v2_event_emails")
        .update({
          subject: REDACTED,
          body_text: REDACTED,
          body_html: null,
          attachments: [],
          from_email: "anonymisiert@" + REDACTED_EMAIL_DOMAIN,
          to_email: "anonymisiert@" + REDACTED_EMAIL_DOMAIN,
          cc_email: null,
        }, { count: "exact" })
        .in("event_id", plan.events_to_anonymize);
      if (error) throw error;
      eventEmailsRedacted = count ?? 0;
    }
  });

  // 4) cost_acceptances / offer_options / offer_history / payments —
  //    nur für buchhaltungsrelevante (verbleibende) Events anonymisieren.
  let costAcceptancesAnonymized = 0;
  await safe("cost_acceptances", async () => {
    if (plan.events_to_anonymize.length > 0) {
      const { error, count } = await admin
        .from("cost_acceptances")
        .update({
          signer_name: REDACTED,
          signer_email: "anonymisiert@" + REDACTED_EMAIL_DOMAIN,
          signer_mobile: null,
          signer_company_name: null,
          onsite_contact: null,
          invoice_company: null,
          invoice_street: null,
          invoice_zip_city: null,
          document_markdown_snapshot: null,
          webhook_events: [],
        }, { count: "exact" })
        .in("inquiry_id", plan.events_to_anonymize);
      if (error) throw error;
      costAcceptancesAnonymized = count ?? 0;
    }
  });

  let offerOptionsAnonymized = 0;
  await safe("v2_offer_options", async () => {
    if (plan.events_to_anonymize.length > 0) {
      const { error, count } = await admin
        .from("v2_offer_options")
        .update({ chosen_by_email: null, chosen_notes: null }, { count: "exact" })
        .in("event_id", plan.events_to_anonymize);
      if (error) throw error;
      offerOptionsAnonymized = count ?? 0;
    }
  });

  let offerHistoryRedacted = 0;
  await safe("v2_event_offer_history", async () => {
    if (plan.events_to_anonymize.length > 0) {
      const { error, count } = await admin
        .from("v2_event_offer_history")
        .update({ email_content: null }, { count: "exact" })
        .in("event_id", plan.events_to_anonymize);
      if (error) throw error;
      offerHistoryRedacted = count ?? 0;
    }
  });

  let paymentsNotesCleared = 0;
  await safe("v2_payments", async () => {
    if (plan.events_to_anonymize.length > 0) {
      const { error, count } = await admin
        .from("v2_payments")
        .update({ notes: null }, { count: "exact" })
        .in("event_id", plan.events_to_anonymize);
      if (error) throw error;
      paymentsNotesCleared = count ?? 0;
    }
  });

  // v2_events selbst: bei buchhaltungsrelevanten Events personenbezogene
  // Freitextfelder leeren; die eigentliche Zeile bleibt für die Buchhaltung.
  await safe("v2_events (anonymize)", async () => {
    if (plan.events_to_anonymize.length > 0) {
      const { error } = await admin
        .from("v2_events")
        .update({
          customer_notes: null,
          internal_notes: null,
          email_draft: null,
          quote_notes: null,
          delivery_address: null,
          delivery_street: null,
          delivery_zip: null,
          delivery_city: null,
          delivery_floor: null,
        })
        .in("id", plan.events_to_anonymize);
      if (error) throw error;
    }
  });

  // 5) Nicht-buchhaltungsrelevante Events hart löschen (CASCADE räumt die
  //    meisten Kind-Tabellen automatisch ab, s. Migrationskommentare).
  let eventsHardDeleted = 0;
  await safe("v2_events (hard delete)", async () => {
    if (plan.events_to_hard_delete.length > 0) {
      const { error, count } = await admin
        .from("v2_events")
        .delete({ count: "exact" })
        .in("id", plan.events_to_hard_delete);
      if (error) throw error;
      eventsHardDeleted = count ?? 0;
    }
  });

  // 6) balance_payment_links — immer anonymisieren (Kontaktfelder), Link-
  //    Mechanik/Beträge bleiben.
  let balanceLinksAnonymized = 0;
  await safe("balance_payment_links", async () => {
    if (graph.balancePaymentLinks.length > 0) {
      const ids = graph.balancePaymentLinks.map((b) => b.id as string);
      const { error, count } = await admin
        .from("balance_payment_links")
        .update({
          customer_name: REDACTED,
          customer_email: "anonymisiert@" + REDACTED_EMAIL_DOMAIN,
          notes: null,
          active: false,
        }, { count: "exact" })
        .in("id", ids);
      if (error) throw error;
      balanceLinksAnonymized = count ?? 0;
    }
  });

  // 7) vouchers — immer anonymisieren (Käufer/Empfänger-Kontakt), Code/
  //    Betrag/Status bleiben für Einlösung & Buchhaltung erhalten.
  let vouchersAnonymized = 0;
  await safe("vouchers", async () => {
    if (graph.vouchers.length > 0) {
      const ids = graph.vouchers.map((v) => v.id as string);
      const { error, count } = await admin
        .from("vouchers")
        .update({
          purchaser_name: REDACTED,
          purchaser_email: "anonymisiert@" + REDACTED_EMAIL_DOMAIN,
          recipient_name: null,
          recipient_email: null,
          message: null,
          notes: null,
        }, { count: "exact" })
        .in("id", ids);
      if (error) throw error;
      vouchersAnonymized = count ?? 0;
    }
  });

  // 8) auth.users löschen (cascaded: customer_profiles via ON DELETE CASCADE,
  //    v2_customers.auth_user_id via ON DELETE SET NULL).
  let authUsersDeleted = 0;
  for (const authUserId of plan.auth_users_to_delete) {
    await safe(`auth.users ${authUserId}`, async () => {
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) throw error;
      authUsersDeleted += 1;
    });
  }

  // 9) v2_customers — hart löschen, wo keine Events mehr referenzieren,
  //    sonst anonymisieren.
  let customersHardDeleted = 0;
  await safe("v2_customers (hard delete)", async () => {
    if (plan.customers_to_hard_delete.length > 0) {
      const { error, count } = await admin
        .from("v2_customers")
        .delete({ count: "exact" })
        .in("id", plan.customers_to_hard_delete);
      if (error) throw error;
      customersHardDeleted = count ?? 0;
    }
  });

  let customersAnonymized = 0;
  await safe("v2_customers (anonymize)", async () => {
    for (const customerId of plan.customers_to_anonymize) {
      const { error } = await admin
        .from("v2_customers")
        .update({
          name: REDACTED,
          company: null,
          email: anonymizedEmail(customerId),
          phone: null,
          address_street: null,
          address_zip: null,
          address_city: null,
          internal_notes: null,
        })
        .eq("id", customerId);
      if (error) throw error;
      customersAnonymized += 1;
    }
  });

  return {
    events_hard_deleted: eventsHardDeleted,
    events_anonymized: plan.events_to_anonymize.length,
    customers_hard_deleted: customersHardDeleted,
    customers_anonymized: customersAnonymized,
    auth_users_deleted: authUsersDeleted,
    inquiry_attachments_deleted: inquiryAttachmentsDeleted,
    ai_conversations_deleted: aiConversationsDeleted,
    review_request_log_deleted: reviewLogDeleted,
    email_delivery_logs_deleted: emailDeliveryLogsDeleted,
    event_comments_deleted: commentsDeleted,
    event_tasks_deleted: tasksDeleted,
    event_changelog_deleted: changelogDeleted,
    inbox_emails_redacted: inboxEmailsRedacted,
    inbox_emails_left_shared: inboxEmailsLeftShared,
    event_emails_redacted: eventEmailsRedacted,
    cost_acceptances_anonymized: costAcceptancesAnonymized,
    offer_options_anonymized: offerOptionsAnonymized,
    offer_history_redacted: offerHistoryRedacted,
    payments_notes_cleared: paymentsNotesCleared,
    balance_payment_links_anonymized: balanceLinksAnonymized,
    vouchers_anonymized: vouchersAnonymized,
    errors,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Audit — wiederverwendet die bestehende data_purge_audit-Tabelle.
// ──────────────────────────────────────────────────────────────────────────

async function writeAudit(
  admin: SupabaseClient,
  args: {
    mode: "dry" | "hard";
    customerId: string;
    graph: GdprCustomerGraph;
    plan: ErasurePlan;
    triggeredBy: string;
    affected: ErasureResult | null;
  },
) {
  try {
    await admin.from("data_purge_audit").insert({
      policy_id: null,
      scope: "customer_erasure",
      mode: args.mode,
      candidate_count: args.graph.events.length + args.graph.customers.length,
      affected_count: args.affected
        ? args.affected.events_hard_deleted + args.affected.customers_hard_deleted +
          args.affected.events_anonymized + args.affected.customers_anonymized
        : 0,
      candidate_ids: {
        customer_ids: args.graph.customers.map((c) => c.id),
        event_ids: args.graph.eventIds,
      },
      status: args.affected && args.affected.errors.length > 0 ? "error" : "ok",
      error_message: args.affected && args.affected.errors.length > 0
        ? args.affected.errors.join("; ")
        : null,
      triggered_by: args.triggeredBy,
      finished_at: new Date().toISOString(),
      details: {
        requested_customer_id: args.customerId,
        plan: args.plan,
        summary: summarizeGraph(args.graph),
        result: args.affected,
      },
    });
  } catch (auditErr) {
    console.error("[delete-customer-data] audit log failed", auditErr);
  }
}
