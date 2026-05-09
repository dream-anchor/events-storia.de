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

    const body = await req.json().catch(() => null);
    if (!body?.email_id) return err("email_id required");
    const unblock_sender: boolean = !!body.unblock_sender;

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: email, error: eErr } = await admin
      .from("inbox_emails")
      .select("id, from_email")
      .eq("id", body.email_id)
      .single();
    if (eErr || !email) return err("Email not found", 404);
    const fromLower = String(email.from_email || "").toLowerCase();

    // 1. Restore single email
    const { error: u1 } = await admin
      .from("inbox_emails")
      .update({ is_hidden: false, hidden_reason: null, hidden_at: null, hidden_by: null })
      .eq("id", body.email_id);
    if (u1) return err(`Restore failed: ${u1.message}`, 500);

    let senderUnblocked = false;
    let affected = 1;

    if (unblock_sender && fromLower) {
      const { error: dErr } = await admin
        .from("email_sender_blocklist")
        .delete()
        .eq("from_email", fromLower);
      if (dErr) return err(`Unblock failed: ${dErr.message}`, 500);
      senderUnblocked = true;

      // Restore only emails hidden because of blocklist
      const { data: restored, error: bulkErr } = await admin
        .from("inbox_emails")
        .update({ is_hidden: false, hidden_reason: null, hidden_at: null, hidden_by: null })
        .ilike("from_email", fromLower)
        .eq("hidden_reason", "sender_blocklisted")
        .select("id");
      if (bulkErr) return err(`Bulk restore failed: ${bulkErr.message}`, 500);
      affected = (restored?.length ?? 0) + 1;
    }

    return json({ ok: true, restored: true, sender_unblocked: senderUnblocked, affected_emails: affected });
  } catch (e) {
    return err((e as Error).message || "Internal error", 500);
  }
});