/**
 * Edge-compatible knowledge helpers: chunking, risk classification, and
 * a string-based text extractor (no Node FS). Mirrors the logic of
 * src/lib/knowledge/* and scripts/_extract-public-content.ts so the
 * knowledge-index-github edge function can run entirely in Deno.
 */

// ---------- Chunking ----------
export interface Chunk {
  index: number;
  content: string;
}

const TARGET_MIN = 800;
const TARGET_MAX = 1500;

export function chunkText(text: string): Chunk[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return [];
  if (cleaned.length <= TARGET_MAX) return [{ index: 0, content: cleaned }];

  const paragraphs = cleaned.split(/\n\s*\n+/);
  const chunks: Chunk[] = [];
  let buf = "";
  const flush = () => {
    const v = buf.trim();
    if (v.length > 0) chunks.push({ index: chunks.length, content: v });
    buf = "";
  };
  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if (para.length > TARGET_MAX) {
      if (buf) flush();
      const sentences = para.match(/[^.!?\n]+[.!?]+|\S[^.!?\n]*$/g) ?? [para];
      for (const s of sentences) {
        const sent = s.trim();
        if (!sent) continue;
        if ((buf + " " + sent).length > TARGET_MAX) {
          if (buf.length >= TARGET_MIN) flush();
          if (sent.length > TARGET_MAX) {
            for (let i = 0; i < sent.length; i += TARGET_MAX) {
              chunks.push({
                index: chunks.length,
                content: sent.slice(i, i + TARGET_MAX).trim(),
              });
            }
            continue;
          }
        }
        buf = buf ? `${buf} ${sent}` : sent;
      }
      if (buf.length >= TARGET_MIN) flush();
      continue;
    }
    if (!buf) buf = para;
    else if ((buf + "\n\n" + para).length <= TARGET_MAX) buf = `${buf}\n\n${para}`;
    else {
      flush();
      buf = para;
    }
  }
  if (buf) flush();
  return chunks;
}

// ---------- Risk classification ----------
export type KnowledgeRisk = "business_rule" | "legal" | null;

const PRICE_PATTERNS: RegExp[] = [
  /\b\d+[.,]?\d*\s*(€|eur|euro)\b/i,
  /\b(eur|€)\s*\d/i,
  /\bab\s+\d/i,
  /\bpreis(e|liste|en)?\b/i,
  /\bkostet\b/i,
  /\bmindestbestell(wert|menge|umsatz)/i,
  /\bliefergebühr|lieferkosten|liefer(pauschale|aufschlag)/i,
  /\banfahrts(pauschale|kosten)\b/i,
  /\banzahlung\s+\d+\s*%/i,
  /\b\d+\s*%\s*(rabatt|discount|anzahlung|deposit|aufschlag|mwst|ust|tax)/i,
  /\bmwst|mehrwertsteuer|ust\.|netto|brutto\b/i,
  /\bkaution\b/i,
  /\bpauschal(e|preis|betrag)\b/i,
];

const LEGAL_PATTERNS: RegExp[] = [
  /\bagb\b/i,
  /\bwiderruf/i,
  /\bhaftung/i,
  /\bgewährleistung/i,
  /\bgarantie/i,
  /\bstorno|stornierung|rücktritt/i,
  /\bdatenschutz/i,
  /\bimpressum/i,
  /\brückerstattung|refund/i,
  /\bzahlungs(frist|ziel|bedingungen)/i,
  /\bvertrag(s|liche)/i,
  /\bverbindlich\b/i,
];

export function classifyKnowledgeRisk(text: string): KnowledgeRisk {
  const t = text || "";
  for (const re of LEGAL_PATTERNS) if (re.test(t)) return "legal";
  for (const re of PRICE_PATTERNS) if (re.test(t)) return "business_rule";
  return null;
}

export function classifyPathRisk(path: string): KnowledgeRisk {
  const p = (path || "").toLowerCase();
  if (
    p.includes("/agb") ||
    p.includes("widerruf") ||
    p.includes("datenschutz") ||
    p.includes("impressum") ||
    p.includes("haftung") ||
    p.includes("lebensmittelhinweise") ||
    p.includes("zahlungsinformationen") ||
    p.includes("cookie")
  ) {
    return "legal";
  }
  if (p.includes("cateringpreise") || p.includes("preise")) {
    return "business_rule";
  }
  return null;
}

// ---------- Path filtering ----------
const ALLOWED_EXT = new Set([".tsx", ".ts", ".jsx", ".js"]);

const INCLUDE_PREFIXES = [
  "src/pages/",
  "src/components/",
  "src/contexts/LanguageContext",
];

const EXCLUDE_SUBSTRINGS = [
  "/admin/",
  "/Admin/",
  "/refine/",
  "Admin.tsx",
  "AdminLogin.tsx",
  "RefineAdmin.tsx",
  "AdminLayout",
  "/ui/",
  "/hooks/",
  "/__tests__/",
  ".test.",
  ".spec.",
  "integrations/supabase",
  "lib/utils.ts",
];

export function isAllowedPath(path: string): boolean {
  if (!path) return false;
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot) : "";
  if (!ALLOWED_EXT.has(ext)) return false;
  const matchesInclude = INCLUDE_PREFIXES.some((p) => path.startsWith(p));
  if (!matchesInclude) return false;
  for (const sub of EXCLUDE_SUBSTRINGS) if (path.includes(sub)) return false;
  return true;
}

// ---------- Text extraction from source code ----------
const TECHNICAL_RE = [
  /^[a-z][a-z0-9_-]*$/i,
  /^[#./][\w\-/]*$/,
  /^https?:\/\//i,
  /^mailto:/i,
  /^tel:/i,
  /^\/[\w\-./]*$/,
  /^[A-Z][A-Za-z0-9]*$/,
  /^[a-z]+:[a-z]/i,
  /^[a-z][a-zA-Z0-9-]*\s+[a-z][a-zA-Z0-9-]*(\s+[a-z][a-zA-Z0-9-]*)+$/,
  /^use[A-Z]/,
  /\bdata-[a-z-]+=/,
];

function looksTechnical(s: string): boolean {
  const v = s.trim();
  if (v.length < 3) return true;
  if (/^[\w:\-/\s.[\]()#%]+$/.test(v) && /\s/.test(v)) {
    const tokens = v.split(/\s+/);
    const techy = tokens.filter((t) =>
      /^([a-z]+:)?(bg|text|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|flex|grid|gap|rounded|border|shadow|font|leading|tracking|space|items|justify|self|order|min|max|absolute|relative|sticky|fixed|hidden|block|inline|hover|focus|group|aria|data)[\w/\-.[\]()]*$/i.test(t) ||
      /^-?\d+(\.\d+)?$/.test(t) ||
      /^#[0-9a-f]{3,8}$/i.test(t)
    );
    if (techy.length / tokens.length > 0.5) return true;
  }
  for (const re of TECHNICAL_RE) if (re.test(v)) return true;
  if (!/[a-zäöüß]/i.test(v)) return true;
  return false;
}

function stripCodeNoise(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, " ")
    .replace(/^\s*export\s+(type|interface|enum)\s+[\s\S]*?\}\s*$/gm, " ");
}

function extractStringLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/"([^"\\\n]{3,400}(?:\\.[^"\\\n]*)*)"/g)) out.push(m[1]);
  for (const m of src.matchAll(/'([^'\\\n]{3,400}(?:\\.[^'\\\n]*)*)'/g)) out.push(m[1]);
  for (const m of src.matchAll(/`([^`$\n]{3,400})`/g)) out.push(m[1]);
  return out;
}

function extractJsxText(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/>([^<>{}\n][^<>{}]{2,400})</g)) out.push(m[1]);
  return out;
}

function guessLocale(path: string, content: string): "de" | "en" {
  const lower = path.toLowerCase();
  if (/\/en\//.test(lower)) return "en";
  const deMarkers = ["und", "für", "über", "mit", "wir", "ihr", "ihre", "können"];
  const enMarkers = ["the", "your", "with", "and", "for", "we", "can"];
  const lc = content.toLowerCase();
  let de = 0;
  let en = 0;
  for (const w of deMarkers) if (lc.includes(` ${w} `)) de += 1;
  for (const w of enMarkers) if (lc.includes(` ${w} `)) en += 1;
  if (de === 0 && en === 0) return "de";
  return en > de ? "en" : "de";
}

function deriveTitleFromPath(p: string): string {
  const base = p.split("/").pop() || p;
  const noExt = base.replace(/\.[^.]+$/, "");
  return noExt.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const v = raw.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!v) continue;
    if (looksTechnical(v)) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export interface ExtractedDocument {
  path: string;
  title: string;
  content: string;
  locale: "de" | "en";
}

export function extractDocumentFromSource(
  path: string,
  rawSource: string,
): ExtractedDocument | null {
  if (!rawSource.trim()) return null;
  const cleaned = stripCodeNoise(rawSource);
  const literals = extractStringLiterals(cleaned);
  const jsx = extractJsxText(cleaned);
  const all = uniqueLines([...jsx, ...literals]);
  const content = all.join("\n");
  if (content.length < 120) return null;
  return {
    path,
    title: deriveTitleFromPath(path),
    content,
    locale: guessLocale(path, content),
  };
}

// ---------- Hashing (SHA-256 hex via Web Crypto) ----------
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}