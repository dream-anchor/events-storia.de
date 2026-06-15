import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "inquiry-attachments";
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 10;
const SIGNED_UPLOAD_TTL = 60 * 5; // 5 minutes

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
  "doc",
  "docx",
]);

const MIME_EXT_MAP: Record<string, Set<string>> = {
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
  "application/pdf": new Set(["pdf"]),
  "application/msword": new Set(["doc"]),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    new Set(["docx"]),
};

// In-memory rate limit per conversation (best-effort; resets on cold start).
const rateMap = new Map<string, { count: number; reset: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

function checkRate(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || entry.reset < now) {
    rateMap.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count += 1;
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120) || "file";
}

function getExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
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

  let body: {
    conversationId?: unknown;
    filename?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const conversationId =
    typeof body.conversationId === "string" ? body.conversationId : "";
  const filename = typeof body.filename === "string" ? body.filename : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const sizeBytes =
    typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes)
      ? Math.floor(body.sizeBytes)
      : -1;

  if (!UUID_RE.test(conversationId)) {
    return json({ error: "invalid_conversation_id" }, 400);
  }
  if (!filename || filename.length > 255) {
    return json({ error: "invalid_filename" }, 400);
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return json({ error: "mime_not_allowed" }, 400);
  }
  const ext = getExt(filename);
  if (!ALLOWED_EXT.has(ext)) {
    return json({ error: "extension_not_allowed" }, 400);
  }
  if (!MIME_EXT_MAP[mimeType]?.has(ext)) {
    return json({ error: "mime_extension_mismatch" }, 400);
  }
  if (sizeBytes <= 0) {
    return json({ error: "invalid_size" }, 400);
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return json({ error: "file_too_large", maxBytes: MAX_FILE_BYTES }, 400);
  }

  if (!checkRate(conversationId)) {
    return json({ error: "rate_limited" }, 429);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1. Conversation exists + status check
  const { data: conv, error: convErr } = await supabase
    .from("ai_conversations")
    .select("id, status")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr) {
    console.error("conv_lookup_failed");
    return json({ error: "lookup_failed" }, 500);
  }
  if (!conv) return json({ error: "conversation_not_found" }, 404);
  if (!["active", "ready_to_submit"].includes(conv.status)) {
    return json({ error: "conversation_not_open" }, 409);
  }

  // 2. Per-conversation aggregates
  const { data: existing, error: aggErr } = await supabase
    .from("inquiry_attachments")
    .select("size_bytes")
    .eq("conversation_id", conversationId);
  if (aggErr) {
    console.error("agg_lookup_failed");
    return json({ error: "lookup_failed" }, 500);
  }
  const count = existing?.length ?? 0;
  const total = (existing ?? []).reduce(
    (s, r) => s + (Number(r.size_bytes) || 0),
    0,
  );
  if (count >= MAX_FILES) {
    return json({ error: "too_many_files", max: MAX_FILES }, 409);
  }
  if (total + sizeBytes > MAX_TOTAL_BYTES) {
    return json(
      { error: "conversation_quota_exceeded", maxTotalBytes: MAX_TOTAL_BYTES },
      409,
    );
  }

  // 3. Build path + signed upload URL
  const safeName = sanitizeFilename(filename);
  const fileUuid = crypto.randomUUID();
  const storagePath = `ai-intake/${conversationId}/${fileUuid}-${safeName}`;

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signErr || !signed) {
    console.error("sign_upload_failed");
    return json({ error: "sign_failed" }, 500);
  }

  // 4. Pre-record
  const { data: inserted, error: insErr } = await supabase
    .from("inquiry_attachments")
    .insert({
      conversation_id: conversationId,
      inquiry_id: null,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      original_filename: filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      uploaded_by: "customer",
      source: "ai_intake_bar",
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("prerecord_failed");
    // Best-effort cleanup of the signed slot is not needed (object not created yet).
    return json({ error: "prerecord_failed" }, 500);
  }

  return json({
    attachmentId: inserted.id,
    storagePath,
    signedUploadUrl: signed.signedUrl,
    token: signed.token,
    expiresIn: SIGNED_UPLOAD_TTL,
  });
});