// Edge Function: convert-photos-to-webp
// Re-encodes all photo_album entries to optimized WebP (max 1920px long-edge,
// quality ~0.82) for SEO/GEO. Idempotent — skips photos that are already small
// WebP. Admin/staff only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Polyfill ImageData (Deno edge runtime has no DOM). jSquash codecs construct
// `new ImageData(data, width, height)` internally.
if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: "srgb" = "srgb";
    constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
      if (typeof data === "number") {
        // new ImageData(width, height)
        const w = data;
        const h = width;
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      } else {
        this.data = data;
        this.width = width;
        this.height = height ?? data.length / 4 / width;
      }
    }
  }
  (globalThis as { ImageData?: unknown }).ImageData = ImageDataPolyfill;
}

// Google jSquash WASM codecs — only WebP encoder that works reliably on Deno
// edge runtime. imagescript has no WebP encoder.
import { decode as decodePng } from "https://esm.sh/@jsquash/png@3.0.1?target=deno";
import { decode as decodeJpeg } from "https://esm.sh/@jsquash/jpeg@1.5.0?target=deno";
import {
  decode as decodeWebp,
  encode as encodeWebp,
} from "https://esm.sh/@jsquash/webp@1.4.0?target=deno";

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
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 600;
const SKIP_IF_WEBP_AND_UNDER_BYTES = 400 * 1024;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function replaceExt(path: string, ext: string): string {
  return path.replace(/\.[^.\/]+$/, `.${ext}`);
}

type RGBA = { data: Uint8ClampedArray; width: number; height: number };

function sniffFormat(bytes: Uint8Array, path: string): "png" | "jpeg" | "webp" | "unknown" {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "jpeg";
  if (p.endsWith(".webp")) return "webp";
  return "unknown";
}

async function decodeAny(bytes: Uint8Array, path: string): Promise<RGBA> {
  const fmt = sniffFormat(bytes, path);
  if (fmt === "png") return await decodePng(bytes) as RGBA;
  if (fmt === "jpeg") return await decodeJpeg(bytes) as RGBA;
  if (fmt === "webp") return await decodeWebp(bytes) as RGBA;
  throw new Error(`unsupported image format (${fmt})`);
}

// Bilinear resize of an RGBA buffer.
function resizeRGBA(src: RGBA, targetW: number, targetH: number): RGBA {
  const { data: s, width: sw, height: sh } = src;
  const dst = new Uint8ClampedArray(targetW * targetH * 4);
  const xRatio = sw / targetW;
  const yRatio = sh / targetH;
  for (let y = 0; y < targetH; y++) {
    const sy = y * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, sh - 1);
    const yf = sy - y0;
    for (let x = 0; x < targetW; x++) {
      const sx = x * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, sw - 1);
      const xf = sx - x0;
      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const di = (y * targetW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = s[i00 + c] * (1 - xf) + s[i01 + c] * xf;
        const bot = s[i10 + c] * (1 - xf) + s[i11 + c] * xf;
        dst[di + c] = top * (1 - yf) + bot * yf;
      }
    }
  }
  return { data: dst, width: targetW, height: targetH };
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
    let img = await decodeAny(buf, row.storage_path);
    const longEdge = Math.max(img.width, img.height);
    if (longEdge > MAX_EDGE) {
      const scale = MAX_EDGE / longEdge;
      img = resizeRGBA(img, Math.round(img.width * scale), Math.round(img.height * scale));
    }

    // Encode WebP (quality 0-100).
    const encoded = await encodeWebp(
      { data: img.data, width: img.width, height: img.height } as ImageData,
      { quality: 82 },
    );
    const webpBytes = new Uint8Array(encoded);

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
    const msg = (e as Error).message;
    console.error(`convert failed for ${row.id} (${row.storage_path}):`, msg);
    return { id: row.id, status: "failed", error: msg };
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

  // Optional body: { limit?: number } — process only N pending photos per call
  // so the UI can loop until done without hitting the gateway timeout.
  let limit: number | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(body.limit, 100);
    }
  } catch { /* no body */ }

  const { data: rows, error: listErr } = await admin
    .from("photo_album")
    .select("id, storage_path, filename, file_size, width")
    .order("created_at");
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Filter out rows that the quick-skip would discard anyway, so `limit`
  // actually advances real work.
  const pending = (rows ?? []).filter((r: { storage_path: string; file_size: number | null; width: number | null }) => {
    if (
      r.storage_path.toLowerCase().endsWith(".webp") &&
      r.file_size !== null && r.file_size < SKIP_IF_WEBP_AND_UNDER_BYTES &&
      r.width !== null && r.width <= MAX_EDGE
    ) return false;
    return true;
  });
  const work = limit ? pending.slice(0, limit) : pending;

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    const batch = work.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((r) => processPhoto(admin, r as never)));
    for (const r of results) {
      if (r.status === "converted") converted++;
      else if (r.status === "skipped") skipped++;
      else { failed++; errors.push(`${r.id}: ${r.error}`); }
    }
    if (i + BATCH_SIZE < work.length) await sleep(BATCH_DELAY_MS);
  }

  const totalPending = pending.length;
  const remaining = Math.max(0, totalPending - work.length - converted - skipped);

  return new Response(
    JSON.stringify({
      processed: work.length,
      total: rows?.length ?? 0,
      pending_total: totalPending,
      remaining,
      converted,
      skipped,
      failed,
      errors: errors.slice(0, 20),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});