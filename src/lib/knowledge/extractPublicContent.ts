import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Pragmatic source extractor: walks the project source tree, strips JS/JSX
 * code and collects human-readable text (JSX text nodes + string/template
 * literals) per file. Output is a flat list of documents the indexer can
 * chunk and store.
 */

export interface ExtractedDocument {
  path: string; // repo-relative path
  title: string;
  content: string;
  locale: "de" | "en" | null;
}

const INCLUDE_DIRS = [
  "src/pages",
  "src/components",
  "src/contexts",
];

const ALLOWED_EXT = new Set([".tsx", ".ts", ".jsx", ".js"]);

const EXCLUDE_PATH_SUBSTRINGS = [
  // Admin / Maestro / internal code
  `${sep}admin${sep}`,
  `${sep}refine${sep}`,
  `${sep}Admin${sep}`,
  "Admin.tsx",
  "AdminLogin.tsx",
  "RefineAdmin.tsx",
  "AdminLayout",
  // UI primitives (no human content)
  `${sep}ui${sep}`,
  `${sep}hooks${sep}`,
  // Tests / dev-only
  `${sep}__tests__${sep}`,
  ".test.",
  ".spec.",
  // Pure technical
  "integrations/supabase",
  "lib/utils.ts",
];

function shouldSkip(filePath: string): boolean {
  for (const sub of EXCLUDE_PATH_SUBSTRINGS) {
    if (filePath.includes(sub)) return true;
  }
  return false;
}

function walk(dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
    } else if (st.isFile()) {
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot) : "";
      if (ALLOWED_EXT.has(ext) && !shouldSkip(full)) out.push(full);
    }
  }
}

/**
 * Very pragmatic text extraction: removes imports / comments, then collects:
 *   - JSX text nodes ( >...< )
 *   - string literals "..." / '...'
 *   - template literals `...` (without ${} interpolations)
 * Filters obvious technical tokens (className strings, single short tokens,
 * urls, file paths, etc.).
 */
const TECHNICAL_RE = [
  /^[a-z][a-z0-9_-]*$/i, // single token
  /^[#./][\w\-/]*$/, // class/path
  /^https?:\/\//i,
  /^mailto:/i,
  /^tel:/i,
  /^\/[\w\-./]*$/, // route path
  /^[A-Z][A-Za-z0-9]*$/, // PascalCase component name
  /^[a-z]+:[a-z]/i, // tailwind variants like md:flex
  /^[a-z][a-zA-Z0-9-]*\s+[a-z][a-zA-Z0-9-]*(\s+[a-z][a-zA-Z0-9-]*)+$/, // class lists
  /^use[A-Z]/, // hook names
  /\bdata-[a-z-]+=/,
];

function looksTechnical(s: string): boolean {
  const v = s.trim();
  if (v.length < 3) return true;
  // class strings: many tokens of tailwind-y stuff
  if (/^[\w:\-/\s.[\]()#%]+$/.test(v) && /\s/.test(v)) {
    const tokens = v.split(/\s+/);
    const techy = tokens.filter((t) =>
      /^([a-z]+:)?(bg|text|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|flex|grid|gap|rounded|border|shadow|font|leading|tracking|space|items|justify|self|order|min|max|absolute|relative|sticky|fixed|hidden|block|inline|hover|focus|group|aria|data)[\w/\-.[\]()]*$/i.test(t) ||
      /^-?\d+(\.\d+)?$/.test(t) ||
      /^#[0-9a-f]{3,8}$/i.test(t),
    );
    if (techy.length / tokens.length > 0.5) return true;
  }
  for (const re of TECHNICAL_RE) if (re.test(v)) return true;
  // no letters at all
  if (!/[a-zäöüß]/i.test(v)) return true;
  return false;
}

function stripCodeNoise(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/(^|[^:])\/\/.*$/gm, "$1") // line comments
    .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, " ")
    .replace(/^\s*export\s+(type|interface|enum)\s+[\s\S]*?\}\s*$/gm, " ");
}

function extractStringLiterals(src: string): string[] {
  const out: string[] = [];
  // double-quoted
  for (const m of src.matchAll(/"([^"\\\n]{3,400}(?:\\.[^"\\\n]*)*)"/g)) {
    out.push(m[1]);
  }
  // single-quoted
  for (const m of src.matchAll(/'([^'\\\n]{3,400}(?:\\.[^'\\\n]*)*)'/g)) {
    out.push(m[1]);
  }
  // template literals (no ${})
  for (const m of src.matchAll(/`([^`$\n]{3,400})`/g)) {
    out.push(m[1]);
  }
  return out;
}

function extractJsxText(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/>([^<>{}\n][^<>{}]{2,400})</g)) {
    out.push(m[1]);
  }
  return out;
}

function guessLocale(path: string, content: string): "de" | "en" | null {
  const lower = path.toLowerCase();
  if (/[/\\]en[/\\]/.test(lower)) return "en";
  if (/languagecontext/.test(lower)) return null;
  // crude heuristic on content
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
  const base = p.split(sep).pop() || p;
  const noExt = base.replace(/\.[^.]+$/, "");
  // PascalCase / camelCase → spaced
  return noExt.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const v = raw
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!v) continue;
    if (looksTechnical(v)) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function extractAllDocuments(repoRoot: string): ExtractedDocument[] {
  const files: string[] = [];
  for (const d of INCLUDE_DIRS) walk(join(repoRoot, d), files);

  const docs: ExtractedDocument[] = [];
  for (const abs of files) {
    let raw: string;
    try {
      raw = readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    if (!raw.trim()) continue;
    const cleaned = stripCodeNoise(raw);
    const literals = extractStringLiterals(cleaned);
    const jsx = extractJsxText(cleaned);
    const all = uniqueLines([...jsx, ...literals]);
    const content = all.join("\n");
    if (content.length < 120) continue; // too thin to be useful
    const rel = relative(repoRoot, abs).split(sep).join("/");
    docs.push({
      path: rel,
      title: deriveTitleFromPath(rel),
      content,
      locale: guessLocale(abs, content),
    });
  }
  return docs;
}