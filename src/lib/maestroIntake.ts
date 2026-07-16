/**
 * STORIA Lead-Cutover: schlanker, typisierter Client für den öffentlichen MAESTRO-2.0-Intake.
 *
 * Alle aktiven Website-Leads gehen ausschließlich hierüber nach MAESTRO 2.0 (Tenant wird SERVERSEITIG
 * aus dem Ziel-Host storia.schrittmacher.ai aufgelöst — der Browser sendet NIE eine tenant_id).
 * Erfolg gilt NUR, wenn eine konkrete Inquiry-ID zurückkommt; jeder 4xx/5xx oder eine Antwort ohne
 * ID wirft (kein Silent-Fallback auf Supabase v1, keine falsche Erfolgsmeldung).
 */
/**
 * Ziel-Endpunkt AUSSCHLIESSLICH aus der Build-Time-Konfiguration (VITE_MAESTRO_INTAKE_URL).
 * KEIN hartkodierter Produktions-Fallback: Produktions-Builds zeigen auf den produktiven STORIA-
 * Mandanten, Preview/Test-Builds auf einen nichtproduktiven Endpoint. Fehlt/ungültig -> sichtbarer
 * Fehler (kein stiller Rückfall von Preview auf Produktion). Nur öffentliche URL, kein Secret.
 */
export function requireMaestroUrl(raw: string | undefined, name: string): string {
  const u = (raw ?? "").trim();
  if (!/^https:\/\/[^\s]+$/.test(u)) {
    throw new Error(`${name} ist nicht konfiguriert (erwartet https-URL) — Build-Time-Konfiguration fehlt.`);
  }
  return u;
}
// Lazy (erst beim Submit ausgewertet) — eine fehlende Konfiguration crasht nicht die ganze Seite,
// sondern lässt genau den Absende-Versuch sichtbar fehlschlagen.
const intakeUrl = () => requireMaestroUrl(import.meta.env.VITE_MAESTRO_INTAKE_URL, "VITE_MAESTRO_INTAKE_URL");

export interface MaestroInquiryInput {
  customerName: string;
  customerEmail?: string;
  company?: string;
  phone?: string;
  guests?: number;
  eventType?: string;
  eventDate?: string; // ISO datetime
  eventTime?: string;
  message?: string;
  language?: "de" | "en";
  packageId?: string;
  packageName?: string;
  /** Konkreter Eingang, z. B. events_contact_form (server-validiert: [A-Za-z0-9_-]). */
  sourceDetail: string;
  details?: Record<string, unknown>;
}

export interface MaestroInquiryResult {
  id: string;
  deduped?: boolean;
}

/** Nur definierte Werte senden; leere Strings werden weggelassen (server behandelt leer als leer). */
function clean(input: MaestroInquiryInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

export async function submitMaestroInquiry(input: MaestroInquiryInput): Promise<MaestroInquiryResult> {
  let res: Response;
  try {
    res = await fetch(intakeUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clean(input)),
    });
  } catch (e) {
    throw new Error(`intake_network_error: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`intake_failed_${res.status}${detail ? `: ${detail}` : ""}`);
  }
  let body: { data?: { id?: string; deduped?: boolean } } | null = null;
  try {
    body = (await res.json()) as { data?: { id?: string; deduped?: boolean } };
  } catch {
    throw new Error("intake_bad_response");
  }
  const id = body?.data?.id;
  if (!id) throw new Error("intake_no_id"); // KEIN Erfolg ohne konkrete Inquiry-ID
  return { id, deduped: body.data?.deduped };
}

/** Sammelt nur die vom MAESTRO-details-Vertrag erlaubten Kontextfelder (Herkunft/UTM). */
export function collectIntakeDetails(extra?: Record<string, unknown>): Record<string, unknown> {
  const details: Record<string, unknown> = { ...(extra ?? {}) };
  try {
    if (typeof window !== "undefined") {
      details.originalPage = (window.location.pathname + window.location.search).slice(0, 500);
      if (document.referrer) details.referrer = document.referrer.slice(0, 500);
      const p = new URLSearchParams(window.location.search);
      const utm: Array<[string, string]> = [
        ["utmSource", "utm_source"], ["utmMedium", "utm_medium"], ["utmCampaign", "utm_campaign"],
        ["utmTerm", "utm_term"], ["utmContent", "utm_content"],
      ];
      for (const [key, param] of utm) {
        const val = p.get(param);
        if (val) details[key] = val.slice(0, 200);
      }
    }
  } catch {
    /* Kontext ist optional */
  }
  return details;
}
