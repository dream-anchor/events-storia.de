import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "inquiry-attachments";
const DOWNLOAD_TTL = 60; // seconds

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { attachmentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const attachmentId =
    typeof body.attachmentId === "string" ? body.attachmentId : "";
  if (!UUID_RE.test(attachmentId)) {
    return json({ error: "invalid_attachment_id" }, 400);
  }

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(
    token,
  );
  if (claimsErr || !claims?.claims?.sub) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = claims.claims.sub as string;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Role check via existing has_role function
  const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
    admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    admin.rpc("has_role", { _user_id: userId, _role: "staff" }),
  ]);
  if (!isAdmin && !isStaff) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: att, error: attErr } = await admin
    .from("inquiry_attachments")
    .select("id, storage_bucket, storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (attErr) {
    console.error("attachment_lookup_failed");
    return json({ error: "lookup_failed" }, 500);
  }
  if (!att) return json({ error: "attachment_not_found" }, 404);
  if (att.storage_bucket !== BUCKET) {
    return json({ error: "invalid_bucket" }, 400);
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(att.storage_path, DOWNLOAD_TTL);
  if (signErr || !signed?.signedUrl) {
    console.error("sign_download_failed");
    return json({ error: "sign_failed" }, 500);
  }

  return json({ signedUrl: signed.signedUrl, expiresIn: DOWNLOAD_TTL });
});