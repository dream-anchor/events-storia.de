// Edge Function: convert-photos-to-webp
// Re-encodes all photo_album entries to optimized WebP (max 1920px long-edge,
// quality ~0.82) for SEO/GEO. Idempotent — skips photos that are already small
// WebP. Admin/staff only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// Pure-WASM image library, no native binary, runs in Supabase edge runtime.
import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "photo-album";

const MAX_EDGE = 1920;
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 400;
const SKIP_IF_WEBP_AND_UNDER_BYTES = 400 * 1024;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function replaceExt(path: string, ext: string): string {
  return path.replace(/\.[^.\/]+$/, `.${ext}`);
}

async function processPhoto(
  admin: ReturnType<typeof createClient>,
  row: { id: string; storage_path: string; filename: string | null; file_size: number | null; width: number | null },
): Promise<{ id: string; status: "converted" | "skipped"; bytes?: number } | { id: string; status: "failed"; error: string }> {
  try {
    // Quick skip: already small webp
    if (
      row.storage_path.toLowerCase().endsWith(".webp") &&
      row.file_size !== null &&
      row.file_size < SKIP_IF_WEBP_AND_UNDER_BYTES &&
      row.width !== null &&
      row.width <= MAX_EDGE
    ) {
      return { id: row.id, status: "skipped" };
    }

    // Download original bytes
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(row.storage_path);
    if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message}`);
    const buf = new Uint8Array(await blob.arrayBuffer());

    // Decode + resize
    const decoded = await decode(buf);
    if (!(decoded instanceof Image)) {
      // GIF/animated frames → use first frame
      throw new Error("unsupported image type (animated/GIF)");
    }
    let img: Image = decoded;
    const longEdge = Math.max(img.width, img.height);
    if (longEdge > MAX_EDGE) {
      const scale = MAX_EDGE / longEdge;
      img = img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
    }

    // Encode WebP. imagescript's encodeWEBP takes a "quality" int 0-100.
    const webpBytes = await img.encodeWEBP(82);

    // If new is bigger than old AND already webp, skip (no benefit).
    const oldSize = row.file_size ?? Infinity;
    if (row.storage_path.toLowerCase().endsWith(".webp") && webpBytes.byteLength >= oldSize) {
      return { id: row.id, status: "skipped" };
    }

    const newPath = replaceExt(row.storage_path, "webp");
    const sameKey = newPath === row.storage_path;

    const { error: upErr } = await admin.storage.from(BUCKET).upload(newPath, webpBytes, {
      contentType: "image/webp",
      upsert: true,
    });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    // Remove old object if path changed
    if (!sameKey) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([row.storage_path]);
      if (rmErr) console.warn(`remove old file failed for ${row.storage_path}: ${rmErr.message}`);
    }

    // Build new public URL (bucket may be private — usePhotoAlbum re-signs on read)
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(newPath);

    const newFilename = (() => {
      const f = row.filename ?? "photo";
      return f.replace(/\.[^.]+$/, "") + ".webp";
    })();

    const { error: updErr } = await admin
      .from("photo_album")
      .update({
        storage_path: newPath,
        url: pub.publicUrl,
        filename: newFilename,
        file_size: webpBytes.byteLength,
        width: img.width,
        height: img.height,
      })
      .eq("id", row.id);
    if (updErr) throw new Error(`db update failed: ${updErr.message}`);

    return { id: row.id, status: "converted", bytes: webpBytes.byteLength };
  } catch (e) {
    return { id: row.id, status: "failed", error: (e as Error).message };
  }
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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: rows, error: listErr } = await admin
    .from("photo_album")
    .select("id, storage_path, filename, file_size, width")
    .order("created_at");
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < (rows?.length ?? 0); i += BATCH_SIZE) {
    const batch = rows!.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((r) => processPhoto(admin, r as never)));
    for (const r of results) {
      if (r.status === "converted") converted++;
      else if (r.status === "skipped") skipped++;
      else { failed++; errors.push(`${r.id}: ${r.error}`); }
    }
    if (i + BATCH_SIZE < rows!.length) await sleep(BATCH_DELAY_MS);
  }

  return new Response(
    JSON.stringify({
      processed: rows?.length ?? 0,
      converted,
      skipped,
      failed,
      errors: errors.slice(0, 20),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});