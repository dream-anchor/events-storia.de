// Legt einen Filter an und backfillt alle bestehenden Mails.

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

type FilterType = "from_email" | "subject_contains" | "thread_root";

const VALID_TYPES: FilterType[] = ["from_email", "subject_contains", "thread_root"];

async function backfill(
  eventId: string,
  filterId: string,
  filterType: FilterType,
  filterValue: string,
): Promise<number> {
  // Kandidaten ermitteln
  let query = supabase.from("inbox_emails").select("id");

  if (filterType === "from_email") {
    // Symmetrisch: inbound matched über from_email,
    // outbound_manual matched, wenn filterValue in to_emails ODER cc_emails liegt.
    const v = filterValue.toLowerCase();
    query = query.or(
      `and(direction.eq.inbound,from_email.ilike.${v}),` +
      `and(direction.eq.outbound_manual,to_emails.cs.{${v}}),` +
      `and(direction.eq.outbound_manual,cc_emails.cs.{${v}})`,
    );
  } else if (filterType === "subject_contains") {
    query = query.ilike("subject", `%${filterValue}%`);
  } else if (filterType === "thread_root") {
    // PostgREST or-Filter: message_id, in_reply_to, references_headers contains
    query = query.or(
      `message_id.eq.${filterValue},in_reply_to.eq.${filterValue},references_headers.cs.{${filterValue}}`,
    );
  }

  const { data: emails, error } = await query.limit(10000);
  if (error) throw error;
  if (!emails || emails.length === 0) return 0;

  // Excluded-Links vorab laden, damit wir sie nicht überschreiben
  const emailIds = emails.map((e) => e.id);
  const { data: existing } = await supabase
    .from("event_email_links")
    .select("email_id, is_excluded")
    .eq("event_id", eventId)
    .in("email_id", emailIds);

  const skip = new Set(
    (existing ?? []).map((r) => r.email_id),
  );

  const rowsToInsert = emails
    .filter((e) => !skip.has(e.id))
    .map((e) => ({
      event_id: eventId,
      email_id: e.id,
      link_source: "filter_match",
      matched_filter_id: filterId,
    }));

  if (rowsToInsert.length === 0) return 0;

  // In Batches einfügen, ON CONFLICT ignorieren
  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < rowsToInsert.length; i += BATCH) {
    const batch = rowsToInsert.slice(i, i + BATCH);
    const { error: insErr, count } = await supabase
      .from("event_email_links")
      .upsert(batch, { onConflict: "event_id,email_id", ignoreDuplicates: true, count: "exact" });
    if (insErr) {
      console.error("backfill insert error:", insErr.message);
      continue;
    }
    inserted += count ?? batch.length;
  }
  return inserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { event_id, filter_type, filter_value, label } = body ?? {};
    if (!event_id || !filter_type || !filter_value) {
      return new Response(
        JSON.stringify({ ok: false, error: "event_id, filter_type, filter_value required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!VALID_TYPES.includes(filter_type)) {
      return new Response(
        JSON.stringify({ ok: false, error: `invalid filter_type, must be one of ${VALID_TYPES.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: filterRow, error: fErr } = await supabase
      .from("event_email_filters")
      .insert({
        event_id,
        filter_type,
        filter_value,
        label: label ?? null,
        is_active: true,
      })
      .select("id")
      .single();
    if (fErr) throw fErr;

    const matched = await backfill(event_id, filterRow.id, filter_type, filter_value);

    return new Response(
      JSON.stringify({ ok: true, filter_id: filterRow.id, matched_count: matched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("add-event-email-filter:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});