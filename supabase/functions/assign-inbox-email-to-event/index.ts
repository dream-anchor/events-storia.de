// Ordnet eine inbox_email einem v2_event zu.
// - create_filter=false: nur diese eine Mail verlinken (manual). is_excluded wird zurückgesetzt.
// - create_filter=true:  Auto-Filter (from_email) anlegen + alle bestehenden Mails desselben
//                        Absenders backfillen. Vorher Multi-Inquiry-Check: gibt es offene
//                        andere Events desselben Kunden, gibt es nur eine Warnung zurück.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function getActorUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  try {
    const { data } = await admin.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function findOpenSiblingEvents(fromEmail: string, currentEventId: string) {
  // v2_events hat kein contact_email direkt — Kunde liegt in v2_customers via customer_id
  const { data: customers } = await admin
    .from("v2_customers")
    .select("id")
    .ilike("email", fromEmail);
  const ids = (customers ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  const { data: events } = await admin
    .from("v2_events")
    .select("id, booking_number, date, status, occasion, archived")
    .in("customer_id", ids)
    .neq("id", currentEventId)
    .eq("archived", false)
    .not("status", "in", "(cancelled,completed)");
  return events ?? [];
}

async function backfillFilter(eventId: string, filterId: string, fromEmail: string) {
  const { data: emails } = await admin
    .from("inbox_emails")
    .select("id")
    .ilike("from_email", fromEmail)
    .limit(10000);
  if (!emails || emails.length === 0) return 0;

  const emailIds = emails.map((e) => e.id);
  const { data: existing } = await admin
    .from("event_email_links")
    .select("email_id")
    .eq("event_id", eventId)
    .in("email_id", emailIds);
  const skip = new Set((existing ?? []).map((r) => r.email_id));

  const rows = emails
    .filter((e) => !skip.has(e.id))
    .map((e) => ({
      event_id: eventId,
      email_id: e.id,
      link_source: "filter_match",
      matched_filter_id: filterId,
    }));
  if (rows.length === 0) return 0;

  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error, count } = await admin
      .from("event_email_links")
      .upsert(slice, { onConflict: "event_id,email_id", ignoreDuplicates: true, count: "exact" });
    if (!error) inserted += count ?? slice.length;
  }
  return inserted;
}

async function writeFeedback(email: any, actualEventId: string | null, actualCategory: string) {
  if (!email?.suggestion_generated_at) return;
  try {
    await admin.from("email_classification_feedback").insert({
      email_id: email.id,
      from_email: email.from_email,
      subject: email.subject ?? null,
      body_excerpt: (email.body_text ?? "").slice(0, 500),
      suggested_event_id: email.suggested_event_id ?? null,
      suggested_category: email.suggestion_category ?? null,
      actual_event_id: actualEventId,
      actual_category: actualCategory,
    });
    const wasAccepted =
      email.suggested_event_id === actualEventId && email.suggestion_category === actualCategory;
    await admin
      .from("inbox_emails")
      .update({
        suggestion_accepted_at: wasAccepted ? new Date().toISOString() : null,
        suggestion_overridden_at: !wasAccepted ? new Date().toISOString() : null,
        suggestion_actual_event_id: actualEventId,
      })
      .eq("id", email.id);
  } catch (e) {
    console.error("writeFeedback failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { email_id, event_id, create_filter, force } = body ?? {};
    if (!email_id || !event_id || typeof create_filter !== "boolean") {
      return new Response(
        JSON.stringify({ ok: false, error: "email_id, event_id, create_filter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const actorId = await getActorUserId(req);

    const { data: email, error: emailErr } = await admin
      .from("inbox_emails")
      .select("id, from_email, from_name, subject, body_text, suggested_event_id, suggestion_category, suggestion_generated_at")
      .eq("id", email_id)
      .maybeSingle();
    if (emailErr) throw emailErr;
    if (!email) {
      return new Response(
        JSON.stringify({ ok: false, error: "email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- Modus B: nur diese Mail -----
    if (!create_filter) {
      const { data: existing } = await admin
        .from("event_email_links")
        .select("id")
        .eq("event_id", event_id)
        .eq("email_id", email_id)
        .maybeSingle();

      if (existing) {
        await admin
          .from("event_email_links")
          .update({
            is_excluded: false,
            excluded_at: null,
            excluded_by: null,
            excluded_reason: null,
            link_source: "manual",
          })
          .eq("id", existing.id);
      } else {
        await admin.from("event_email_links").insert({
          event_id,
          email_id,
          link_source: "manual",
          matched_filter_id: null,
          is_excluded: false,
        });
      }
      await writeFeedback(email, event_id, "match");
      return new Response(
        JSON.stringify({ ok: true, event_id, linked_count: 1, filter_id: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // (manual single link feedback handled below right before return)

    // ----- Modus A: Auto-Filter -----
    if (!email.from_email) {
      return new Response(
        JSON.stringify({ ok: false, error: "email has no from_email — cannot create filter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Multi-Inquiry-Warnung
    if (!force) {
      const siblings = await findOpenSiblingEvents(email.from_email, event_id);
      if (siblings.length > 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            warning: "multiple_open_events",
            message:
              `Es gibt ${siblings.length} weitere offene Event(s) für ${email.from_email}. ` +
              "Auto-Filter würde alle Mails dieses Absenders ans aktuelle Event hängen. " +
              "Mit force=true bestätigen oder create_filter=false wählen.",
            sibling_events: siblings,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Bestehenden Filter wiederverwenden, sonst neu anlegen
    const { data: existingFilter } = await admin
      .from("event_email_filters")
      .select("id, is_active")
      .eq("event_id", event_id)
      .eq("filter_type", "from_email")
      .ilike("filter_value", email.from_email)
      .maybeSingle();

    let filterId: string;
    if (existingFilter) {
      filterId = existingFilter.id;
      if (!existingFilter.is_active) {
        await admin
          .from("event_email_filters")
          .update({ is_active: true })
          .eq("id", filterId);
      }
    } else {
      const label = `Auto-erstellt: ${email.from_name || email.from_email}`;
      const { data: filterRow, error: fErr } = await admin
        .from("event_email_filters")
        .insert({
          event_id,
          filter_type: "from_email",
          filter_value: email.from_email,
          label,
          is_active: true,
          created_by: actorId,
        })
        .select("id")
        .single();
      if (fErr) throw fErr;
      filterId = filterRow.id;
    }

    const linked = await backfillFilter(event_id, filterId, email.from_email);

    await writeFeedback(email, event_id, "match");

    return new Response(
      JSON.stringify({ ok: true, event_id, filter_id: filterId, linked_count: linked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("assign-inbox-email-to-event:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});