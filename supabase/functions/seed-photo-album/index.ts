// Edge Function: seed-photo-album
// Crawlt eine fixe Liste öffentlicher Seiten von events-storia.de und
// ristorantestoria.de, extrahiert alle Bild-URLs (jpg/jpeg/png/webp),
// dedupliziert sie und importiert sie ins photo_album (Storage + DB-Row +
// classify-photo). Idempotent über (source_origin, source_filename).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "photo-album";

type Origin = "events-storia" | "ristorante-storia";

const CRAWL_TARGETS: Record<Origin, { base: string; paths: string[] }> = {
  "events-storia": {
    base: "https://events-storia.de",
    paths: [
      "/",
      "/events",
      "/kontakt",
      "/anfrage",
      "/catering/buffet-fingerfood",
      "/catering/buffet-platten",
      "/catering/buffet-auflauf",
      "/catering/pizze-napoletane",
      "/catering/desserts",
      "/italienisches-catering-muenchen",
      "/firmenfeier-catering-muenchen",
      "/weihnachtsfeier-catering-muenchen",
      "/pizza-catering-muenchen",
      "/buero-catering-muenchen",
      "/fingerfood-catering-muenchen",
      "/hochzeit-catering-muenchen",
      "/geburtstag-catering-muenchen",
      "/partyservice-muenchen",
      "/catering-lieferservice-muenchen",
      "/messe-catering-muenchen",
    ],
  },
  "ristorante-storia": {
    base: "https://ristorantestoria.de",
    paths: [
      "/",
      "/speisekarte",
      "/mittagsmenu",
      "/getraenke",
      "/ueber-uns",
      "/kontakt",
    ],
  },
};

// Dateien, die niemals importiert werden sollen (Logos, UI-Icons, Platzhalter)
const EXCLUDE_PATTERNS = [
  /storia-logo/i,
  /favicon/i,
  /placeholder/i,
  /payment-logos/i,
  /stripe-icons/i,
  /apple-touch/i,
  /android-chrome/i,
  /maestro-favicon/i,
  /\.svg($|\?)/i,
];

// Responsive-Duplikate (z.B. ...-600w.webp) überspringen — wir wollen die
// volle Auflösung.
const RESPONSIVE_VARIANT = /-(\d{3,4})w\.(webp|jpe?g|png)$/i;

function isExcluded(url: string): boolean {
  if (EXCLUDE_PATTERNS.some((re) => re.test(url))) return true;
  if (RESPONSIVE_VARIANT.test(url)) return true;
  return false;
}

function basenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last);
  } catch {
    return url.split("/").pop() ?? url;
  }
}

function slugToTitle(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "");
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Image-URLs aus HTML grob extrahieren: src=, srcset=, poster=, og:image,
// CSS url(...). Wir holen anschließend nur jpg/jpeg/png/webp.
function extractImageUrls(html: string, base: string): string[] {
  const urls = new Set<string>();
  const pushAbs = (raw: string) => {
    try {
      const abs = new URL(raw, base).toString();
      if (/\.(webp|jpe?g|png)(\?|$)/i.test(abs)) urls.add(abs.split("?")[0]);
    } catch { /* ignore */ }
  };

  // src="..." / src='...'
  for (const m of html.matchAll(/\s(?:src|data-src|poster)\s*=\s*["']([^"']+)["']/gi)) {
    pushAbs(m[1]);
  }
  // srcset="a 1x, b 2x"
  for (const m of html.matchAll(/\ssrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of m[1].split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u) pushAbs(u);
    }
  }
  // og:image / twitter:image
  for (const m of html.matchAll(/<meta[^>]+property=["'](?:og|twitter):image["'][^>]+content=["']([^"']+)["']/gi)) {
    pushAbs(m[1]);
  }
  // url(...) in inline styles
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    pushAbs(m[1]);
  }

  return Array.from(urls);
}

// Bildmaße aus WebP/JPEG/PNG-Header lesen (ohne Dependencies).
function readImageDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  // PNG: 8 sig + IHDR width@16, height@20
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: scan SOF markers
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      const size = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      i += 2 + size;
    }
  }
  // WebP: "RIFF....WEBP"
  if (
    bytes.length > 30 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    // VP8X
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width: w, height: h };
    }
    // VP8L (lossless)
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      const w = 1 + (((b1 & 0x3f) << 8) | b0);
      const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width: w, height: h };
    }
    // VP8 (lossy)
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
      const w = ((bytes[27] << 8) | bytes[26]) & 0x3fff;
      const h = ((bytes[29] << 8) | bytes[28]) & 0x3fff;
      return { width: w, height: h };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin-Check via JWT
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

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  // 1. Crawl alle Seiten und sammle unique Bild-URLs pro Origin
  const collected: Array<{ origin: Origin; url: string; filename: string }> = [];
  const seen = new Set<string>(); // origin + filename

  for (const [origin, cfg] of Object.entries(CRAWL_TARGETS) as [Origin, typeof CRAWL_TARGETS[Origin]][]) {
    for (const path of cfg.paths) {
      const pageUrl = cfg.base + path;
      try {
        const r = await fetch(pageUrl, { headers: { "User-Agent": "StoriaSeedBot/1.0" } });
        if (!r.ok) continue;
        const html = await r.text();
        for (const imgUrl of extractImageUrls(html, pageUrl)) {
          if (isExcluded(imgUrl)) continue;
          const filename = basenameFromUrl(imgUrl);
          if (!filename) continue;
          const key = `${origin}::${filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push({ origin, url: imgUrl, filename });
        }
      } catch (e) {
        console.error(`crawl failed ${pageUrl}:`, e);
      }
    }
  }

  console.log(`seed-photo-album: collected ${collected.length} unique image URLs`);

  // 2. Welche existieren bereits in der DB?
  const filenamesByOrigin: Record<string, string[]> = {};
  for (const c of collected) {
    (filenamesByOrigin[c.origin] ||= []).push(c.filename);
  }
  const existing = new Set<string>();
  for (const [origin, fns] of Object.entries(filenamesByOrigin)) {
    const { data } = await admin
      .from("photo_album")
      .select("source_filename")
      .eq("source_origin", origin)
      .in("source_filename", fns);
    for (const row of data ?? []) {
      existing.add(`${origin}::${row.source_filename}`);
    }
  }

  // 3. Für jedes neue Bild: download → upload → row → classify
  for (const item of collected) {
    const key = `${item.origin}::${item.filename}`;
    if (existing.has(key)) { skipped++; continue; }

    try {
      const resp = await fetch(item.url, { headers: { "User-Agent": "StoriaSeedBot/1.0" } });
      if (!resp.ok) throw new Error(`fetch ${resp.status}`);
      const buf = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type") ?? "image/webp";

      const dims = readImageDimensions(buf);
      const storagePath = `seed/${item.origin}/${item.filename}`;

      const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
        contentType, upsert: true,
      });
      if (upErr) throw upErr;

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

      const { data: row, error: insErr } = await admin
        .from("photo_album")
        .insert({
          storage_path: storagePath,
          url: pub.publicUrl,
          filename: item.filename,
          title: slugToTitle(item.filename),
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          file_size: buf.byteLength,
          source_origin: item.origin,
          source_filename: item.filename,
        })
        .select("id, url")
        .single();
      if (insErr) throw insErr;

      imported++;

      // Klassifizierung fire-and-forget
      admin.functions
        .invoke("classify-photo", { body: { photoId: row.id, photoUrl: row.url } })
        .catch((e) => console.error("classify-photo invoke failed:", e));
    } catch (e) {
      failed++;
      errors.push(`${item.filename}: ${(e as Error).message}`);
      console.error("seed item failed:", item.url, e);
    }
  }

  return new Response(
    JSON.stringify({ imported, skipped, failed, collected: collected.length, errors: errors.slice(0, 20) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});