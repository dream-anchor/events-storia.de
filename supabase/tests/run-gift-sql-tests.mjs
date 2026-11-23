// Führt supabase/tests/gift_stock.sql gegen eine In-Memory-Datenbank (PGlite) aus. Keine echte Datenbank nötig.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/run-gift-sql-tests.mjs
// Ablauf: gift_stub_schema.sql -> Gift-Migrationen (Schema, RPCs, Mischbestellung, Hold-Fenster) -> gift_stock.sql
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");
const db = new PGlite();
db.onNotice?.((n) => console.log("  NOTICE:", n.message));
const steps = [
  "gift_stub_schema.sql",
  "../migrations/20261120100000_gift_baskets_schema.sql",
  "../migrations/20261120100100_gift_baskets_rpcs.sql",
  "../migrations/20261121120000_gift_orders_with_catering.sql",
  "../migrations/20261123100000_gift_stock_hold_window.sql",
  "gift_stock.sql",
];
for (const path of steps) {
  try {
    let sql = read(path);
    // pg_cron/pg_net gibt es in PGlite nicht: den Cron-Teil der RPC-Migration abschneiden (Funktionen davor bleiben vollständig)
    const cut = sql.indexOf("CREATE EXTENSION IF NOT EXISTS pg_cron");
    if (cut > 0) sql = sql.slice(0, cut);
    await db.exec(sql);
    console.log(`ok   ${path}`);
  } catch (e) {
    console.error(`FAIL ${path}: ${e.message}`);
    if (e.detail) console.error("     detail:", e.detail);
    process.exit(1);
  }
}
console.log("alle Gift-SQL-Tests bestanden");
