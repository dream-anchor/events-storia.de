// One-shot: kopiert MAESTRO_HANDOFF_CRON_SECRET aus Edge-Env in vault.secrets
// unter dem Namen 'maestro_handoff_cron_secret'. Auth via Service-Role-Aufruf
// mit Header X-Bootstrap-Token = MAESTRO_HANDOFF_CRON_SECRET (self-auth).
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("MAESTRO_HANDOFF_CRON_SECRET") ?? "";
  const token = req.headers.get("x-bootstrap-token") ?? "";
  if (!secret || token.length !== secret.length) {
    return new Response("unauthorized", { status: 401 });
  }
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ token.charCodeAt(i);
  if (diff !== 0) return new Response("unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Upsert via SQL RPC – use vault functions
  const { data: existing, error: selErr } = await supabase
    .schema("vault" as any)
    .from("secrets" as any)
    .select("id")
    .eq("name", "maestro_handoff_cron_secret")
    .maybeSingle();

  if (selErr) return new Response("select_failed: " + selErr.message, { status: 500 });

  if (existing?.id) {
    const { error } = await supabase.rpc("vault_update_secret_by_name", {
      p_name: "maestro_handoff_cron_secret",
      p_secret: secret,
    });
    if (error) return new Response("update_failed: " + error.message, { status: 500 });
  } else {
    const { error } = await supabase.rpc("vault_create_secret_by_name", {
      p_name: "maestro_handoff_cron_secret",
      p_secret: secret,
    });
    if (error) return new Response("create_failed: " + error.message, { status: 500 });
  }

  return new Response("ok", { status: 200 });
});