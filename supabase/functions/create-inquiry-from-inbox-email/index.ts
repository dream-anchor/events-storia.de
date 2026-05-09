import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return err("Unauthorized", 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return err("Unauthorized", 401);
    const userId: string = claimsData.claims.sub;
    const userEmail: string = claimsData.claims.email ?? "";

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body");

    const email_id: string | undefined = body.email_id;
    const event_data = body.event_data ?? {};
    const create_filter: boolean = body.create_filter !== false;

    if (!email_id) return err("email_id required");
    if (!event_data.datum) return err("event_data.datum required");
    if (!event_data.gaeste || Number(event_data.gaeste) <= 0)
      return err("event_data.gaeste required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Read inbox email
    const { data: email, error: eErr } = await admin
      .from("inbox_emails")
      .select("id, from_email, from_name, subject, body_text, suggested_event_id, suggestion_category, suggestion_generated_at")
      .eq("id", email_id)
      .single();
    if (eErr || !email) return err("Email not found", 404);

    const fromEmail = String(email.from_email || "").trim();
    if (!fromEmail) return err("Email has no from_email");
    const fromEmailLower = fromEmail.toLowerCase();
    const fromName =
      (email.from_name && String(email.from_name).trim()) ||
      fromEmail.split("@")[0];

    // 2. Customer resolution
    let customerId: string | null = null;
    const { data: existing } = await admin
      .from("v2_customers")
      .select("id")
      .ilike("email", fromEmail)
      .is("merged_into_id", null)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      customerId = existing.id;
    } else {
      const { data: newCust, error: cErr } = await admin
        .from("v2_customers")
        .insert({ email: fromEmail, name: fromName })
        .select("id")
        .single();
      if (cErr || !newCust) return err(`Customer create failed: ${cErr?.message}`, 500);
      customerId = newCust.id;
    }

    // 3. Create event
    const eventName: string =
      (event_data.name && String(event_data.name).trim()) ||
      email.subject ||
      "Anfrage per E-Mail";

    const { data: newEvent, error: evErr } = await admin
      .from("v2_events")
      .insert({
        customer_id: customerId,
        status: "inquiry",
        source: "email_inbound",
        date: event_data.datum,
        guest_count: Number(event_data.gaeste),
        occasion: event_data.anlass ?? eventName,
        customer_notes: eventName,
        created_by: userEmail || userId,
      })
      .select("id")
      .single();
    if (evErr || !newEvent) return err(`Event create failed: ${evErr?.message}`, 500);
    const eventId = newEvent.id;

    let filterId: string | null = null;
    let linkedCount = 0;

    if (create_filter) {
      // 4a. Create filter
      const { data: filter, error: fErr } = await admin
        .from("event_email_filters")
        .insert({
          event_id: eventId,
          filter_type: "from_email",
          filter_value: fromEmailLower,
          label: `Auto-erstellt: ${fromName || fromEmail}`,
          created_by: userId,
          is_active: true,
        })
        .select("id")
        .single();
      if (fErr || !filter) return err(`Filter create failed: ${fErr?.message}`, 500);
      filterId = filter.id;

      // 4b. Backfill: all inbox emails with same from_email
      const { data: matchingEmails } = await admin
        .from("inbox_emails")
        .select("id")
        .ilike("from_email", fromEmail);

      const rows = (matchingEmails ?? []).map((m: { id: string }) => ({
        event_id: eventId,
        email_id: m.id,
        link_source: "filter_match",
        matched_filter_id: filterId,
      }));

      if (rows.length > 0) {
        const { error: linkErr } = await admin
          .from("event_email_links")
          .upsert(rows, { onConflict: "event_id,email_id", ignoreDuplicates: true });
        if (linkErr) return err(`Link backfill failed: ${linkErr.message}`, 500);
      }

      const { count } = await admin
        .from("event_email_links")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("is_excluded", false);
      linkedCount = count ?? rows.length;
    } else {
      // 5. Manual single link
      const { error: linkErr } = await admin
        .from("event_email_links")
        .upsert(
          {
            event_id: eventId,
            email_id: email_id,
            link_source: "manual",
            is_excluded: false,
          },
          { onConflict: "event_id,email_id" }
        );
      if (linkErr) return err(`Link failed: ${linkErr.message}`, 500);
      linkedCount = 1;
    }

    return json({
      ok: true,
      event_id: eventId,
      customer_id: customerId,
      filter_id: filterId,
      linked_count: linkedCount,
      redirect_url: `/admin/events/${eventId}/edit`,
    });
  } catch (e) {
    console.error("create-inquiry-from-inbox-email error", e);
    return err((e as Error).message || "Internal error", 500);
  }
});