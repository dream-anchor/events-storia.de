/**
 * Edge-Function Helper — meldet Fehler an System-Health Hub.
 * Nutzt Service-Role direkt gegen RPC `report_system_error_internal`.
 * Schluckt eigene Fehler — darf NIE eine Funktion crashen lassen.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface EdgeReportInput {
  source: string; // z.B. "edge:handle-stripe-webhook"
  severity?: "warning" | "error" | "critical";
  message: string;
  payload?: Record<string, unknown>;
}

function md5Hex(input: string): string {
  // einfacher Hash ohne Crypto-Lib: deterministisch genug für Dedup
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export async function reportEdgeError(input: EdgeReportInput): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const supabase = createClient(url, key);
    const severity = input.severity ?? "error";
    const message = (input.message || "(empty)").slice(0, 2000);
    const source = (input.source || "edge").slice(0, 200);
    const hash = md5Hex(`events_storia|${source}|${message}`);
    await supabase.rpc("report_system_error_internal", {
      p_project: "events_storia",
      p_source: source,
      p_severity: severity,
      p_message: message,
      p_payload_hash: hash,
      p_payload: input.payload ?? null,
      p_url: null,
      p_user_agent: null,
    });
  } catch (_err) {
    // bewusst still
  }
}