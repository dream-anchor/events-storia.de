/**
 * Knowledge Indexer
 * ------------------
 * Walks public-facing source files (pages, components, language context),
 * extracts visible text, chunks + classifies it, and writes the result into
 * the existing `knowledge_sources` / `knowledge_documents` / `knowledge_chunks`
 * tables.
 *
 * Critical content (prices, payment terms, AGB, legal) is written with
 * `status = 'pending_review'` and is NEVER used as a safe answer source by
 * the AI assistant until a human approves it.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/index-knowledge-from-repo.ts
 *
 * Optional flags:
 *   --dry-run    Extract & classify only, print summary, do not write
 */

import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  extractAllDocuments,
  type ExtractedDocument,
} from "./_extract-public-content";
import { chunkText } from "../src/lib/knowledge/chunkText";
import {
  classifyKnowledgeRisk,
  classifyPathRisk,
  type KnowledgeRisk,
} from "../src/lib/knowledge/riskClassifyKnowledge";

const SOURCE_REF = "dream-anchor/events-storia.de";
const SOURCE_TITLE = "events-storia.de Website Content";
const SOURCE_TYPE = "github_repo";

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
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

function summary(docs: ExtractedDocument[]): {
  totalDocs: number;
  totalChunks: number;
  pendingReviewChunks: number;
  activeChunks: number;
  riskCounts: Record<string, number>;
} {
  let totalChunks = 0;
  let pending = 0;
  let active = 0;
  const riskCounts: Record<string, number> = {
    business_rule: 0,
    legal: 0,
    none: 0,
  };
  for (const d of docs) {
    const chunks = buildChunksForDoc(d);
    totalChunks += chunks.length;
    for (const c of chunks) {
      if (c.risk) {
        pending += 1;
        riskCounts[c.risk] += 1;
      } else {
        active += 1;
        riskCounts.none += 1;
      }
    }
  }
  return {
    totalDocs: docs.length,
    totalChunks,
    pendingReviewChunks: pending,
    activeChunks: active,
    riskCounts,
  };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..");
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");

  console.log("[knowledge-indexer] extracting documents…");
  const docs = extractAllDocuments(repoRoot);
  const stats = summary(docs);
  console.log("[knowledge-indexer] summary:", stats);

  if (dryRun) {
    console.log("[knowledge-indexer] --dry-run: skipping DB writes");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[knowledge-indexer] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Upsert source
  const { data: existingSource } = await supabase
    .from("knowledge_sources")
    .select("id")
    .eq("source_type", SOURCE_TYPE)
    .eq("source_ref", SOURCE_REF)
    .maybeSingle();

  let sourceId: string;
  if (existingSource?.id) {
    sourceId = existingSource.id as string;
    await supabase
      .from("knowledge_sources")
      .update({
        title: SOURCE_TITLE,
        status: "active",
        last_indexed_at: new Date().toISOString(),
      })
      .eq("id", sourceId);
  } else {
    const { data: created, error } = await supabase
      .from("knowledge_sources")
      .insert({
        source_type: SOURCE_TYPE,
        source_ref: SOURCE_REF,
        title: SOURCE_TITLE,
        status: "active",
        last_indexed_at: new Date().toISOString(),
        metadata: { extractor: "scripts/index-knowledge-from-repo.ts" },
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[knowledge-indexer] failed to create source", error);
      process.exit(1);
    }
    sourceId = created.id as string;
  }
  console.log("[knowledge-indexer] source id:", sourceId);

  // 2. Load existing docs for this source (path → {id, hash})
  const { data: existingDocs } = await supabase
    .from("knowledge_documents")
    .select("id, path, content_hash")
    .eq("source_id", sourceId);
  const existingByPath = new Map<string, { id: string; content_hash: string | null }>();
  for (const d of existingDocs ?? []) {
    if (d.path) existingByPath.set(d.path, { id: d.id as string, content_hash: d.content_hash as string | null });
  }

  let written = 0;
  let skipped = 0;
  let chunkRows = 0;

  for (const doc of docs) {
    const contentHash = hash(doc.content);
    const built = buildChunksForDoc(doc);
    if (built.length === 0) continue;

    // Determine document-level status: active if NO chunk is risky, else pending_review
    const anyRisky = built.some((c) => c.risk !== null);
    const docStatus = anyRisky ? "pending_review" : "active";
    const docRisks = Array.from(
      new Set(built.map((c) => c.risk).filter((r): r is "business_rule" | "legal" => !!r)),
    );

    const docPayload = {
      source_id: sourceId,
      path: doc.path,
      title: doc.title,
      content: doc.content,
      content_hash: contentHash,
      locale: doc.locale ?? "de",
      status: docStatus,
      metadata: {
        risks: docRisks,
        requires_manual_review: anyRisky,
        chunk_count: built.length,
      },
    };

    const existing = existingByPath.get(doc.path);
    let documentId: string;

    if (existing && existing.content_hash === contentHash) {
      skipped += 1;
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from("knowledge_documents")
        .update(docPayload)
        .eq("id", existing.id);
      if (error) {
        console.error("[knowledge-indexer] update doc failed", doc.path, error.message);
        continue;
      }
      documentId = existing.id;
      // Replace chunks
      await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);
    } else {
      const { data: ins, error } = await supabase
        .from("knowledge_documents")
        .insert(docPayload)
        .select("id")
        .single();
      if (error || !ins) {
        console.error("[knowledge-indexer] insert doc failed", doc.path, error?.message);
        continue;
      }
      documentId = ins.id as string;
    }

    const rows = built.map((c) => ({
      document_id: documentId,
      chunk_index: c.index,
      content: c.content,
      metadata: {
        path: doc.path,
        title: doc.title,
        locale: doc.locale ?? "de",
        risk: c.risk,
        requires_manual_review: c.risk !== null,
        // Chunk-level status is intentionally embedded so the AI can filter
        // even if a future migration drops per-doc filtering.
        status: c.risk ? "pending_review" : "active",
      },
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("knowledge_chunks").insert(rows);
      if (error) {
        console.error("[knowledge-indexer] insert chunks failed", doc.path, error.message);
        continue;
      }
      chunkRows += rows.length;
    }
    written += 1;
  }

  console.log("[knowledge-indexer] done:", { written, skipped, chunkRows });
}

main().catch((e) => {
  console.error("[knowledge-indexer] fatal:", e);
  process.exit(1);
});