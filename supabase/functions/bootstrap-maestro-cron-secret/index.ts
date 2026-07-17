// One-shot: kopiert MAESTRO_HANDOFF_CRON_SECRET aus Edge-Env in vault.secrets
// (via public.set_maestro_cron_secret). Nach Aufruf loeschen.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const secret = Deno.env.get("MAESTRO_HANDOFF_CRON_SECRET") ?? "";
  if (!secret) return new Response("no_env_secret", { status: 500 });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { error } = await supabase.rpc("set_maestro_cron_secret", { p_secret: secret });
  if (error) return new Response("rpc_failed: " + error.message, { status: 500 });
  return new Response("ok", { status: 200 });
});