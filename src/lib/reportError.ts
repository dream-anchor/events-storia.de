// Frontend helper — meldet Production-Fehler an den System-Health Hub.
// Nutzt die public RPC `report_frontend_error` (anon + authenticated dürfen aufrufen).
import { supabase } from "@/integrations/supabase/client";

export interface ReportErrorInput {
  source: string;
  severity?: "warning" | "error" | "critical";
  message: string;
  payload?: Record<string, unknown>;
}

/**
 * Meldet einen Fehler an Maestro System-Health.
 * Schluckt eigene Fehler — darf nie eine UI blockieren.
 */
export async function reportError(input: ReportErrorInput): Promise<void> {
  try {
    const { error } = await supabase.rpc("report_frontend_error" as any, {
      p_source: input.source,
      p_severity: input.severity ?? "error",
      p_message: input.message,
      p_payload: input.payload ?? null,
      p_url: typeof window !== "undefined" ? window.location.href : null,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    } as any);
    if (error) console.warn("[reportError] rpc error", error);
  } catch (err) {
    console.warn("[reportError] failed", err);
  }
}