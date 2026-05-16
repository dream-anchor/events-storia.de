#!/usr/bin/env node
// Preflight-Check vor Publish/Deploy.
// Aufruf: node scripts/preflight.mjs [--strict]
// Exit-Codes: 0 = clean, 1 = Warnungen, 2 = Blocker.

const SUPABASE_URL = "https://sovlfqncotxcjqseeawp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvdmxmcW5jb3R4Y2pxc2VlYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTM5NjMsImV4cCI6MjA4MDUyOTk2M30.t7WJB1ysn4QNDHpXIJ3Gzo5bxuXiTJpJJ-8DSkVpRyc";

const strict = process.argv.includes("--strict");

const checks = [];
function pass(name, detail = "") { checks.push({ name, level: "ok", detail }); }
function warn(name, detail = "") { checks.push({ name, level: "warn", detail }); }
function fail(name, detail = "") { checks.push({ name, level: "fail", detail }); }

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  return res;
}

// 1. Audit-Run frisch?
try {
  const r = await rest(
    "/rest/v1/system_health_audit_runs?select=run_at,had_blockers,email_sent&order=run_at.desc&limit=1",
  );
  if (r.status === 200) {
    const rows = await r.json();
    if (!rows.length) {
      warn("Letzter Audit-Lauf", "noch nie gelaufen — Cron prüfen");
    } else {
      const last = new Date(rows[0].run_at).getTime();
      const ageH = (Date.now() - last) / 3600000;
      if (ageH > 36) fail("Letzter Audit-Lauf", `vor ${ageH.toFixed(1)}h — Cron defekt?`);
      else pass("Letzter Audit-Lauf", `${ageH.toFixed(1)}h alt, Blocker=${rows[0].had_blockers}`);
    }
  } else {
    warn("Audit-Run-Tabelle", `HTTP ${r.status} (RLS — nur Admin liest, das ist ok)`);
  }
} catch (e) {
  fail("Audit-Run-Tabelle", e.message);
}

// 2. Offene kritische Fehler (24h)
try {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const r = await rest(
    `/rest/v1/system_errors?select=id,project,source,message&severity=eq.critical&resolved_at=is.null&last_seen=gte.${since}`,
  );
  if (r.status === 200) {
    const rows = await r.json();
    if (!rows.length) pass("Kritische Fehler (24h)", "0");
    else if (strict) fail("Kritische Fehler (24h)", `${rows.length} offen`);
    else warn("Kritische Fehler (24h)", `${rows.length} offen`);
  } else {
    warn("Kritische Fehler", `HTTP ${r.status}`);
  }
} catch (e) {
  fail("Kritische Fehler", e.message);
}

// 3. Hub-Connection (Test-Ping)
try {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/system-health-daily-audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ triggered_by: "preflight-dryrun" }),
  });
  if (r.ok) pass("Audit-Function erreichbar", `HTTP ${r.status}`);
  else fail("Audit-Function erreichbar", `HTTP ${r.status}`);
} catch (e) {
  fail("Audit-Function erreichbar", e.message);
}

// Ausgabe
const reset = "\x1b[0m";
const colors = { ok: "\x1b[32m", warn: "\x1b[33m", fail: "\x1b[31m" };
const icon = { ok: "✓", warn: "!", fail: "✗" };

console.log("\nMaestro Preflight\n─────────────────");
for (const c of checks) {
  console.log(`${colors[c.level]}${icon[c.level]}${reset} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

const failed = checks.some((c) => c.level === "fail");
const warned = checks.some((c) => c.level === "warn");
console.log("");
if (failed) { console.log("Status: BLOCKER"); process.exit(2); }
if (warned) { console.log("Status: WARN"); process.exit(1); }
console.log("Status: OK"); process.exit(0);