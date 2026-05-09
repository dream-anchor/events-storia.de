// Matched eine einzelne inbox_email gegen alle aktiven event_email_filters
// und legt event_email_links an (ohne is_excluded zu überschreiben).

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

type Email = {
  id: string;
  from_email: string | null;
  subject: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_headers: string[] | null;
  direction: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
};

type Filter = {
  id: string;
  event_id: string;
  filter_type: string;
  filter_value: string;
  is_active: boolean;
};

function emailMatches(email: Email, filter: Filter): boolean {
  const v = (filter.filter_value || "").trim();
  if (!v) return false;
  const vLower = v.toLowerCase();
  switch (filter.filter_type) {
    case "from_email": {
      // Symmetrisch: bei outbound_manual matched ein Empfänger,
      // bei inbound der Absender.
      if (email.direction === "outbound_manual") {
        const recipients = [
          ...(email.to_emails ?? []),
          ...(email.cc_emails ?? []),
        ].map((e) => (e || "").toLowerCase());
        return recipients.includes(vLower);
      }
      return (email.from_email || "").toLowerCase() === vLower;
    }
    case "subject_contains":
      return (email.subject || "").toLowerCase().includes(vLower);
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

async function matchEmail(emailId: string) {
  const { data: email, error: emailErr } = await supabase
    .from("inbox_emails")
    .select(
      "id, from_email, subject, message_id, in_reply_to, references_headers, direction, to_emails, cc_emails",
    )
    .eq("id", emailId)
    .maybeSingle();
  if (emailErr) throw emailErr;
  if (!email) return { matched: 0, skipped: "email_not_found" };

  const { data: filters, error: fErr } = await supabase
    .from("event_email_filters")
    .select("id, event_id, filter_type, filter_value, is_active")
    .eq("is_active", true);
  if (fErr) throw fErr;

  let matched = 0;
  for (const f of (filters as Filter[] | null) ?? []) {
    if (!emailMatches(email as Email, f)) continue;

    // Existiert bereits ein Link? Excluded-Links nicht anfassen.
    const { data: existing } = await supabase
      .from("event_email_links")
      .select("id, is_excluded, matched_filter_id")
      .eq("event_id", f.event_id)
      .eq("email_id", emailId)
      .maybeSingle();

    if (existing) {
      if (existing.is_excluded) continue;
      // Filter-id auffrischen, falls neu gematcht
      if (!existing.matched_filter_id) {
        await supabase
          .from("event_email_links")
          .update({ matched_filter_id: f.id, link_source: "filter_match" })
          .eq("id", existing.id);
      }
      continue;
    }

    const { error: insErr } = await supabase
      .from("event_email_links")
      .insert({
        event_id: f.event_id,
        email_id: emailId,
        link_source: "filter_match",
        matched_filter_id: f.id,
      });
    if (!insErr) matched += 1;
  }
  return { matched };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { email_id } = await req.json();
    if (!email_id || typeof email_id !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "email_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const result = await matchEmail(email_id);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("match-email-to-events:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});