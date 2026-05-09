// Soft-Delete eines Filters + Aufräumen der Links, sofern keine andere
// aktive Filter-Regel die Mail mit dem Event verbindet.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function emailMatchesFilter(
  email: {
    from_email: string | null;
    subject: string | null;
    message_id: string | null;
    in_reply_to: string | null;
    references_headers: string[] | null;
  },
  filter: { filter_type: string; filter_value: string },
): boolean {
  const v = (filter.filter_value || "").trim();
  if (!v) return false;
  switch (filter.filter_type) {
    case "from_email":
      return (email.from_email || "").toLowerCase() === v.toLowerCase();
    case "subject_contains":
      return (email.subject || "").toLowerCase().includes(v.toLowerCase());
    case "thread_root":
      return (
        email.message_id === v ||
        email.in_reply_to === v ||
        (email.references_headers ?? []).includes(v)
      );
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { filter_id } = await req.json();
    if (!filter_id || typeof filter_id !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "filter_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter laden
    const { data: filter, error: fErr } = await supabase
      .from("event_email_filters")
      .select("id, event_id, filter_type, filter_value, is_active")
      .eq("id", filter_id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!filter) {
      return new Response(
        JSON.stringify({ ok: false, error: "filter not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Soft-Delete
    await supabase
      .from("event_email_filters")
      .update({ is_active: false })
      .eq("id", filter_id);

    // Andere aktive Filter desselben Events
    const { data: otherFilters } = await supabase
      .from("event_email_filters")
      .select("id, filter_type, filter_value")
      .eq("event_id", filter.event_id)
      .eq("is_active", true);

    // Alle Links, die durch diesen Filter entstanden sind, ohne Excluded
    const { data: links } = await supabase
      .from("event_email_links")
      .select("id, email_id, is_excluded, link_source, matched_filter_id")
      .eq("event_id", filter.event_id)
      .eq("matched_filter_id", filter_id)
      .eq("is_excluded", false)
      .eq("link_source", "filter_match");

    if (!links || links.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, removed_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emailIds = links.map((l) => l.email_id);

    // Mails laden für Re-Match-Check
    const { data: emails } = await supabase
      .from("inbox_emails")
      .select(
        "id, from_email, subject, message_id, in_reply_to, references_headers",
      )
      .in("id", emailIds);

    const emailById = new Map((emails ?? []).map((e) => [e.id, e]));

    const toDelete: string[] = [];
    const toReassign: { id: string; new_filter_id: string }[] = [];

    for (const link of links) {
      const email = emailById.get(link.email_id);
      if (!email) {
        toDelete.push(link.id);
        continue;
      }
      const stillMatching = (otherFilters ?? []).find((f) =>
        emailMatchesFilter(email, f),
      );
      if (stillMatching) {
        toReassign.push({ id: link.id, new_filter_id: stillMatching.id });
      } else {
        toDelete.push(link.id);
      }
    }

    let removed = 0;
    if (toDelete.length > 0) {
      const { error, count } = await supabase
        .from("event_email_links")
        .delete({ count: "exact" })
        .in("id", toDelete);
      if (!error) removed = count ?? toDelete.length;
    }

    for (const r of toReassign) {
      await supabase
        .from("event_email_links")
        .update({ matched_filter_id: r.new_filter_id })
        .eq("id", r.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        removed_count: removed,
        reassigned_count: toReassign.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("remove-event-email-filter:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});