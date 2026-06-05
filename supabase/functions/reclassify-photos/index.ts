// Edge Function: reclassify-photos
// Iterates over photo_album entries and invokes classify-photo sequentially
// (in small parallel batches) so no invocations are lost to fire-and-forget
// shutdowns. Admin/staff only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 600;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin/staff check via JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
  const { data: isStaff } = await userClient.rpc("has_role", { _user_id: user.id, _role: "staff" });
  if (!isAdmin && !isStaff) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mode: "all" (default) reklassifiziert alles; "missing" nur unklassifizierte.
  let mode: "all" | "missing" = "all";
  try {
    const body = await req.json();
    if (body?.mode === "missing") mode = "missing";
  } catch { /* default */ }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let query = admin.from("photo_album").select("id").order("created_at");
  if (mode === "missing") query = query.eq("ai_classified", false);
  const { data: rows, error: listErr } = await query;
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Reset state when running a full reclassification, so stale "pizza"
  // mislabels are overwritten.
  if (mode === "all" && rows && rows.length > 0) {
    await admin
      .from("photo_album")
      .update({ ai_classified: false, category: null, tags: [], ai_error: null })
      .in("id", rows.map((r) => r.id));
  }

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < (rows?.length ?? 0); i += BATCH_SIZE) {
    const batch = rows!.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (r) => {
        try {
          const { data, error } = await admin.functions.invoke("classify-photo", {
            body: { photoId: r.id },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          return { id: r.id, ok: true };
        } catch (e) {
          return { id: r.id, ok: false, error: (e as Error).message };
        }
      }),
    );
    for (const r of results) {
      if (r.ok) ok++;
      else { failed++; errors.push(`${r.id}: ${r.error}`); }
    }
    if (i + BATCH_SIZE < rows!.length) await sleep(BATCH_DELAY_MS);
  }

  return new Response(
    JSON.stringify({
      mode,
      processed: rows?.length ?? 0,
      ok,
      failed,
      errors: errors.slice(0, 20),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});