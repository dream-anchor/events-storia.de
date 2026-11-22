// Führt die SQL-Tests der Bestell-Abdichtung gegen eine In-Memory-Datenbank (PGlite) aus. Keine echte Datenbank nötig.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/run-sql-tests.mjs
// Ablauf: Stub-Schema -> Preisprüf-Migration -> order_price_guard.sql -> Sperr-Migration -> order_checkout_seal.sql
// Die Tests wechseln per SET ROLE zwischen anon/authenticated/service_role und simulieren das JWT über request.jwt.claims.
import { PGlite } from "@electric-sql/pglite";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");
const db = new PGlite();
const steps = [
  ["stub_schema.sql", "stub_schema.sql"],
  ["20261122100000_order_price_guard.sql", "../migrations/20261122100000_order_price_guard.sql"],
  ["order_price_guard.sql", "order_price_guard.sql"],
  ["20261122110000_order_checkout_seal.sql", "../migrations/20261122110000_order_checkout_seal.sql"],
  ["order_checkout_seal.sql", "order_checkout_seal.sql"],
];
db.onNotice?.((n) => console.log("  NOTICE:", n.message));
for (const [label, path] of steps) {
  // Sperr-Migration und ihr Test liegen in einem eigenen PR: fehlen sie (noch), wird der Schritt übersprungen
  if (!existsSync(join(here, path))) {
    console.log(`skip ${label} (Datei nicht vorhanden)`);
    continue;
  }
  try {
    await db.exec(read(path));
    console.log(`ok   ${label}`);
  } catch (e) {
    console.error(`FAIL ${label}: ${e.message}`);
    if (e.detail) console.error("     detail:", e.detail);
    process.exit(1);
  }
}
console.log("alle SQL-Tests bestanden");
