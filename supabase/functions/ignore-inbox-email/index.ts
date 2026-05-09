import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const err = (m: string, s = 400) => json({ ok: false, error: m }, s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return err("Unauthorized", 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return err("Unauthorized", 401);
    const userId: string = claims.claims.sub;

    const body = await req.json().catch(() => null);
    if (!body?.email_id) return err("email_id required");
    const ignore_sender: boolean = !!body.ignore_sender;
    const reason: string = body.reason || "manually ignored";

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: email, error: eErr } = await admin
      .from("inbox_emails")
      .select("id, from_email, subject, body_text, suggested_event_id, suggestion_category, suggestion_generated_at")
      .eq("id", body.email_id)
      .single();
    if (eErr || !email) return err("Email not found", 404);
    const fromLower = String(email.from_email || "").toLowerCase();

    // 1. Hide the single email
    const { error: u1 } = await admin
      .from("inbox_emails")
      .update({
        is_hidden: true,
        hidden_reason: reason,
        hidden_at: new Date().toISOString(),
        hidden_by: userId,
      })
      .eq("id", body.email_id);
    if (u1) return err(`Hide failed: ${u1.message}`, 500);

    let senderBlocked = false;
    let affected = 1;

    if (ignore_sender && fromLower) {
      const { error: bErr } = await admin
        .from("email_sender_blocklist")
        .upsert(
          { from_email: fromLower, blocked_by: userId, reason, blocked_at: new Date().toISOString() },
          { onConflict: "from_email" }
        );
      if (bErr) return err(`Blocklist failed: ${bErr.message}`, 500);
      senderBlocked = true;

      const { error: bulkErr } = await admin
        .from("inbox_emails")
        .update({
          is_hidden: true,
          hidden_reason: "sender_blocklisted",
          hidden_at: new Date().toISOString(),
          hidden_by: userId,
        })
        .ilike("from_email", fromLower)
        .eq("is_hidden", false);
      if (bulkErr) return err(`Bulk hide failed: ${bulkErr.message}`, 500);

      const { count } = await admin
        .from("inbox_emails")
        .select("id", { count: "exact", head: true })
        .ilike("from_email", fromLower)
        .eq("is_hidden", true);
      affected = count ?? 1;
    }

    return json({ ok: true, hidden: true, sender_blocked: senderBlocked, affected_emails: affected });
  } catch (e) {
    return err((e as Error).message || "Internal error", 500);
  }
});