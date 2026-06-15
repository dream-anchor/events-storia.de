/**
 * knowledge-index-github
 * ----------------------
 * Admin-only endpoint that re-indexes the public website content of the
 * GitHub repo `dream-anchor/events-storia.de` into the Knowledge Base.
 *
 * - POST only
 * - Requires a valid Supabase JWT (Authorization: Bearer ...)
 * - Requires the calling user to have the `admin` role (via `has_role`)
 * - Reads files from GitHub via the public API + raw.githubusercontent.com
 * - Honours include/exclude path rules (no admin/maestro code)
 * - Upserts into `knowledge_sources` / `knowledge_documents` / `knowledge_chunks`
 * - Critical content (prices, AGB, legal) is stored with status = pending_review
 *   and is therefore NEVER returned to the AI assistant as a safe answer source.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  chunkText,
  classifyKnowledgeRisk,
  classifyPathRisk,
  extractDocumentFromSource,
  isAllowedPath,
  sha256Hex,
  type ExtractedDocument,
  type KnowledgeRisk,
} from "../_shared/knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REPO = "dream-anchor/events-storia.de";
const BRANCH = "main";
const SOURCE_REF = REPO;
const SOURCE_TITLE = "events-storia.de Website Content";
const SOURCE_TYPE = "github_repo";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface GhTreeEntry {
  path: string;
  type: "blob" | "tree" | string;
  size?: number;
}

async function ghFetchTree(token: string | null): Promise<GhTreeEntry[]> {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const headers: Record<string, string> = {
    "User-Agent": "events-storia-knowledge-indexer",
    Accept: "application/vnd.github+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`github_tree_${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  if (!Array.isArray(body?.tree)) throw new Error("github_tree_invalid_shape");
  return body.tree as GhTreeEntry[];
}

async function ghFetchRaw(path: string, token: string | null): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  const headers: Record<string, string> = {
    "User-Agent": "events-storia-knowledge-indexer",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return await res.text();
}

interface BuiltChunk {
  index: number;
  content: string;
  risk: KnowledgeRisk;
}

function buildChunksForDoc(doc: ExtractedDocument): BuiltChunk[] {
  const docPathRisk = classifyPathRisk(doc.path);
  return chunkText(doc.content).map((c) => {
    const chunkRisk = classifyKnowledgeRisk(c.content);
    const risk: KnowledgeRisk = chunkRisk ?? docPathRisk ?? null;
    return { index: c.index, content: c.content, risk };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const jwt = authHeader.replace("Bearer ", "");

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !anonKey) return json({ error: "server_misconfigured" }, 500);
  if (!serviceKey) return json({ error: "missing_service_role" }, 500);

  // 1. Verify user from JWT
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
  if (claimsErr || !claimsData?.claims?.sub) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  // 2. Verify admin role via existing has_role function
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr) {
    return json({ error: "role_check_failed", detail: roleErr.message }, 500);
  }
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  // 3. Parse optional body
  let payload: { dryRun?: boolean } = {};
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      payload = await req.json();
    } catch {
      return json({ error: "invalid_payload" }, 400);
    }
  }
  const dryRun = payload.dryRun === true;

  const ghToken = Deno.env.get("GITHUB_TOKEN") || null;

  // 4. Fetch GitHub tree
  let tree: GhTreeEntry[];
  try {
    tree = await ghFetchTree(ghToken);
  } catch (e) {
    return json({ error: "github_fetch_failed", detail: (e as Error).message }, 502);
  }

  const candidatePaths = tree
    .filter((e) => e.type === "blob" && isAllowedPath(e.path))
    .map((e) => e.path);

  // 5. Fetch raw sources and extract docs
  const warnings: string[] = [];
  const docs: ExtractedDocument[] = [];
  let filesScanned = 0;

  // Small concurrency limit to be nice to raw.githubusercontent.com
  const CONCURRENCY = 8;
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= candidatePaths.length) return;
      const path = candidatePaths[i];
      try {
        const src = await ghFetchRaw(path, ghToken);
        filesScanned += 1;
        if (!src) {
          warnings.push(`raw_not_found:${path}`);
          continue;
        }
        const doc = extractDocumentFromSource(path, src);
        if (doc) docs.push(doc);
      } catch (e) {
        warnings.push(`raw_error:${path}:${(e as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // 6. Pre-compute chunk stats
  let totalChunksPlanned = 0;
  let pendingDocs = 0;
  let activeDocs = 0;
  const prepared: Array<{
    doc: ExtractedDocument;
    chunks: BuiltChunk[];
    contentHash: string;
    status: "active" | "pending_review";
    risks: KnowledgeRisk[];
  }> = [];
  for (const doc of docs) {
    const chunks = buildChunksForDoc(doc);
    if (chunks.length === 0) continue;
    const contentHash = await sha256Hex(doc.content);
    const anyRisky = chunks.some((c) => c.risk !== null);
    const status: "active" | "pending_review" = anyRisky ? "pending_review" : "active";
    if (anyRisky) pendingDocs += 1;
    else activeDocs += 1;
    totalChunksPlanned += chunks.length;
    const risks = Array.from(
      new Set(chunks.map((c) => c.risk).filter((r): r is "business_rule" | "legal" => !!r)),
    );
    prepared.push({ doc, chunks, contentHash, status, risks });
  }

  if (dryRun) {
    return json({
      success: true,
      dryRun: true,
      sourceId: null,
      filesScanned,
      documentsUpserted: 0,
      documentsSkipped: 0,
      chunksInserted: 0,
      activeDocuments: activeDocs,
      pendingReviewDocuments: pendingDocs,
      plannedChunks: totalChunksPlanned,
      warnings,
    });
  }

  // 7. Upsert source
  let sourceId: string;
  try {
    const { data: existingSource, error: srcSelErr } = await admin
      .from("knowledge_sources")
      .select("id")
      .eq("source_type", SOURCE_TYPE)
      .eq("source_ref", SOURCE_REF)
      .maybeSingle();
    if (srcSelErr) throw srcSelErr;
    if (existingSource?.id) {
      sourceId = existingSource.id as string;
      const { error: updErr } = await admin
        .from("knowledge_sources")
        .update({
          title: SOURCE_TITLE,
          status: "active",
          last_indexed_at: new Date().toISOString(),
          metadata: { indexer: "knowledge-index-github", branch: BRANCH },
        })
        .eq("id", sourceId);
      if (updErr) throw updErr;
    } else {
      const { data: created, error: insErr } = await admin
        .from("knowledge_sources")
        .insert({
          source_type: SOURCE_TYPE,
          source_ref: SOURCE_REF,
          title: SOURCE_TITLE,
          status: "active",
          last_indexed_at: new Date().toISOString(),
          metadata: { indexer: "knowledge-index-github", branch: BRANCH },
        })
        .select("id")
        .single();
      if (insErr || !created) throw insErr ?? new Error("source_insert_no_row");
      sourceId = created.id as string;
    }
  } catch (e) {
    return json({ error: "supabase_write_failed", detail: (e as Error).message }, 500);
  }

  // 8. Load existing docs to enable hash-skip
  const { data: existingDocs, error: exDocsErr } = await admin
    .from("knowledge_documents")
    .select("id, path, content_hash")
    .eq("source_id", sourceId);
  if (exDocsErr) {
    return json({ error: "supabase_write_failed", detail: exDocsErr.message }, 500);
  }
  const existingByPath = new Map<string, { id: string; content_hash: string | null }>();
  for (const d of existingDocs ?? []) {
    if (d.path) {
      existingByPath.set(d.path, {
        id: d.id as string,
        content_hash: (d.content_hash as string | null) ?? null,
      });
    }
  }

  let documentsUpserted = 0;
  let documentsSkipped = 0;
  let chunksInserted = 0;

  for (const p of prepared) {
    const existing = existingByPath.get(p.doc.path);
    if (existing && existing.content_hash === p.contentHash) {
      documentsSkipped += 1;
      continue;
    }

    const docPayload = {
      source_id: sourceId,
      path: p.doc.path,
      title: p.doc.title,
      content: p.doc.content,
      content_hash: p.contentHash,
      locale: p.doc.locale,
      status: p.status,
      metadata: {
        risks: p.risks,
        requires_manual_review: p.status === "pending_review",
        risk: p.risks[0] ?? null,
        chunk_count: p.chunks.length,
        indexer: "knowledge-index-github",
      },
    };

    let documentId: string;
    if (existing) {
      const { error: updErr } = await admin
        .from("knowledge_documents")
        .update(docPayload)
        .eq("id", existing.id);
      if (updErr) {
        warnings.push(`doc_update_failed:${p.doc.path}:${updErr.message}`);
        continue;
      }
      documentId = existing.id;
      const { error: delErr } = await admin
        .from("knowledge_chunks")
        .delete()
        .eq("document_id", documentId);
      if (delErr) {
        warnings.push(`chunks_clear_failed:${p.doc.path}:${delErr.message}`);
        continue;
      }
    } else {
      const { data: ins, error: insErr } = await admin
        .from("knowledge_documents")
        .insert(docPayload)
        .select("id")
        .single();
      if (insErr || !ins) {
        warnings.push(`doc_insert_failed:${p.doc.path}:${insErr?.message ?? "no_row"}`);
        continue;
      }
      documentId = ins.id as string;
    }

    const rows = p.chunks.map((c) => ({
      document_id: documentId,
      chunk_index: c.index,
      content: c.content,
      metadata: {
        path: p.doc.path,
        title: p.doc.title,
        locale: p.doc.locale,
        risk: c.risk,
        requires_manual_review: c.risk !== null,
        status: c.risk ? "pending_review" : "active",
      },
    }));
    if (rows.length > 0) {
      const { error: chErr } = await admin.from("knowledge_chunks").insert(rows);
      if (chErr) {
        warnings.push(`chunks_insert_failed:${p.doc.path}:${chErr.message}`);
        continue;
      }
      chunksInserted += rows.length;
    }
    documentsUpserted += 1;
  }

  // 9. Final counts
  const { count: activeCount } = await admin
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("status", "active");
  const { count: pendingCount } = await admin
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("status", "pending_review");

  return json({
    success: true,
    sourceId,
    filesScanned,
    documentsUpserted,
    documentsSkipped,
    chunksInserted,
    activeDocuments: activeCount ?? 0,
    pendingReviewDocuments: pendingCount ?? 0,
    warnings,
  });
});