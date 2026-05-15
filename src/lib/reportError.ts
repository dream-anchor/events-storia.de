// Frontend helper — meldet Production-Fehler an den Hub.
// Hub-URL = die report-system-error Edge-Function dieses Projekts.
import { supabase } from "@/integrations/supabase/client";

const HUB_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-system-error`;
const PROJECT = "events_storia" as const;

// Public — der shared_secret wird im FE NICHT exponiert, weil
// dieses Projekt der Hub selbst ist. Wir nutzen daher direkt die DB
// via service-side rpc nicht möglich — stattdessen call ohne shared_secret
// indem wir via authenticated supabase-client gehen. Aber der Hub-Endpoint
// erwartet shared_secret. Lösung: für same-origin Frontend rufen wir die
// rpc-Funktion direkt auf (RLS verhindert Insert via PostgREST, aber
// die SECURITY DEFINER rpc darf das wenn wir sie freigeben).
// Pragmatisch jetzt: Frontend POSTet ohne shared_secret an einen
// alternativen Pfad — vereinfachte Variante: wir nutzen die rpc direkt
// (siehe report_system_error_internal). Da sie SECURITY DEFINER ist,
// muss noch ein public-wrapper her. Bis dahin: log-only.

export interface ReportErrorInput {
  source: string;
  severity?: "warning" | "error" | "critical";
  message: string;
  payload?: Record<string, unknown>;
}

/**
 * Meldet einen Fehler. Schluckt eigene Fehler — darf nie eine UI blockieren.
 */
export async function reportError(input: ReportErrorInput): Promise<void> {
  try {
    // Wir gehen über die supabase-client rpc. Für die Aufruf-Erlaubnis
    // brauchen wir noch eine public wrapper-rpc; bis dahin: console + best-effort
    // POST an Hub mit Bearer (anon-key) — der Hub validiert intern.
    const body = {
      project: PROJECT,
      source: input.source,
      severity: input.severity ?? "error",
      message: input.message,
      payload: input.payload ?? null,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      // shared_secret wird vom Backend-Aufrufer (Edge-Functions) gesetzt;
      // Frontend nutzt einen separaten Pfad — siehe TODO.
    };

    // Best-effort: Edge-Function akzeptiert keine FE-Calls ohne shared_secret.
    // Wir loggen daher in console; sobald die public-rpc-wrapper steht, hier
    // umstellen auf supabase.rpc("report_system_error_public", body).
    console.warn("[reportError]", body);
  } catch (err) {
    console.warn("[reportError] failed", err);
  }
}