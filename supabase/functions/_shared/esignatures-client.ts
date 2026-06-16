/**
 * Shared eSignatures.com API Client.
 *
 * Stellt Helfer zur Verfügung, die in mehreren Edge Functions wiederverwendet
 * werden können. Ziel dieses Schrittes: nur bereitstellen — bestehende
 * Functions werden NICHT angepasst. Auth-Schemata orientieren sich an dem,
 * was die jeweiligen Live-Functions heute verwenden, damit später ohne
 * Verhaltensänderung umgestellt werden kann.
 *
 * WICHTIG: Der API-Key wird niemals geloggt oder in Fehlermeldungen
 * eingebettet.
 */

export const ESIGNATURES_API_BASE = "https://esignatures.com/api";

/**
 * Liest ESIGNATURES_API_KEY aus den Edge-Function-Secrets.
 * Wirft einen klaren Fehler, wenn nicht gesetzt. Loggt das Secret nie.
 */
export function getEsignaturesApiKey(): string {
  const key = Deno.env.get("ESIGNATURES_API_KEY");
  if (!key || key.trim().length === 0) {
    throw new Error(
      "ESIGNATURES_API_KEY ist nicht konfiguriert. Bitte Secret in den Edge-Function-Einstellungen setzen.",
    );
  }
  return key;
}

/**
 * Basic-Auth Header — entspricht der heute funktionierenden Template-Create-
 * Function (`create-esignatures-cost-acceptance-template`).
 */
function basicAuthHeader(apiKey: string): string {
  return `Basic ${btoa(`${apiKey}:`)}`;
}

/** Sicheres Parsen eines Response-Bodies als JSON (oder Text-Fallback). */
async function readJsonOrText(res: Response): Promise<{ json: unknown; text: string }> {
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { json, text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Robustes Parsing für Template-Create-Responses. Unterstützt:
 * - payload.data.template_id
 * - payload.data[0].template_id
 * - payload.template_id
 * - payload.data.template.id
 * - payload.template.id
 */
export function extractTemplateId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const candidates: unknown[] = [];
  const data = payload.data;

  if (Array.isArray(data)) {
    const first = data[0];
    if (isRecord(first)) {
      candidates.push(first.template_id);
      if (isRecord(first.template)) candidates.push(first.template.id);
    }
  } else if (isRecord(data)) {
    candidates.push(data.template_id);
    if (isRecord(data.template)) candidates.push(data.template.id);
  }

  candidates.push(payload.template_id);
  if (isRecord(payload.template)) candidates.push(payload.template.id);

  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

/**
 * Robustes Parsing für Contract-Create-Responses. Unterstützt:
 * - payload.data.contract
 * - payload.contract
 * - payload.data
 */
// deno-lint-ignore no-explicit-any
export function extractContract(payload: unknown): any | null {
  if (!isRecord(payload)) return null;

  const data = payload.data;
  if (isRecord(data)) {
    if (isRecord(data.contract)) return data.contract;
    // payload.data sieht selbst wie ein Contract aus
    if (typeof data.id === "string" || Array.isArray(data.signers)) {
      return data;
    }
  }
  if (isRecord(payload.contract)) return payload.contract;

  return null;
}

/**
 * Baut aus einer unbekannten API-Response eine kompakte, menschen­lesbare
 * Fehlermeldung. Gibt niemals Secrets aus — wir lesen nur Felder, die die
 * eSignatures-API in Fehlerfällen befüllt.
 */
export function extractErrorDetail(payload: unknown, fallbackText: string): string {
  if (isRecord(payload)) {
    const detail =
      payload.message ??
      payload.error ??
      payload.errors ??
      (isRecord(payload.data) ? payload.data.message ?? payload.data.error : undefined);
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (detail !== undefined) {
      try {
        const s = JSON.stringify(detail);
        return s.length > 500 ? `${s.slice(0, 500)}…` : s;
      } catch {
        /* fallthrough */
      }
    }
  }
  const t = fallbackText ?? "";
  return t.length > 500 ? `${t.slice(0, 500)}…` : t;
}

/**
 * Legt ein Template bei eSignatures.com an.
 * Auth + Endpoint orientieren sich exakt an der funktionierenden Function
 * `create-esignatures-cost-acceptance-template` (Basic-Auth, POST /templates).
 */
export async function createEsignaturesTemplate(
  input: { title: string; markdown: string },
): Promise<{ template_id: string; raw: unknown }> {
  const apiKey = getEsignaturesApiKey();

  const res = await fetch(`${ESIGNATURES_API_BASE}/templates`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: input.title, markdown: input.markdown }),
  });

  const { json, text } = await readJsonOrText(res);

  if (!res.ok) {
    const detail = extractErrorDetail(json, text);
    throw new Error(
      `eSignatures template creation failed: ${res.status}${
        res.statusText ? ` ${res.statusText}` : ""
      }${detail ? ` - ${detail}` : ""}`,
    );
  }

  const templateId = extractTemplateId(json);
  if (!templateId) {
    const detail = extractErrorDetail(json, text);
    throw new Error(
      `eSignatures API response missing template_id${detail ? ` - ${detail}` : ""}`,
    );
  }

  return { template_id: templateId, raw: json };
}

/**
 * Erstellt einen Contract bei eSignatures.com.
 * Auth + Endpoint orientieren sich exakt an der funktionierenden Function
 * `create-cost-acceptance-from-public-offer` (Token-Query, POST /contracts).
 */
export async function createEsignaturesContract(
  payload: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
): Promise<{ contract: any; raw: unknown }> {
  const apiKey = getEsignaturesApiKey();

  const res = await fetch(
    `${ESIGNATURES_API_BASE}/contracts?token=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const { json, text } = await readJsonOrText(res);

  const apiError =
    isRecord(json) && (json.status === "error" || json.status === "failed");
  if (!res.ok || apiError) {
    const detail = extractErrorDetail(json, text);
    throw new Error(
      `eSignatures contract creation failed: ${res.status}${
        res.statusText ? ` ${res.statusText}` : ""
      }${detail ? ` - ${detail}` : ""}`,
    );
  }

  const contract = extractContract(json);
  if (!contract) {
    const detail = extractErrorDetail(json, text);
    throw new Error(
      `eSignatures API response missing contract${detail ? ` - ${detail}` : ""}`,
    );
  }

  return { contract, raw: json };
}

/**
 * Zieht einen Contract zurück (best-effort).
 * Auth + Endpoint orientieren sich an der vorhandenen Function
 * `withdraw-cost-acceptance` (Token-Query, POST /contracts/:id/withdraw).
 */
export async function withdrawEsignaturesContract(
  contractId: string,
): Promise<{ ok: boolean; raw?: unknown }> {
  if (!contractId || contractId.trim().length === 0) {
    throw new Error("contractId fehlt");
  }
  const apiKey = getEsignaturesApiKey();

  try {
    const res = await fetch(
      `${ESIGNATURES_API_BASE}/contracts/${encodeURIComponent(contractId)}/withdraw?token=${encodeURIComponent(apiKey)}`,
      { method: "POST" },
    );
    const { json, text } = await readJsonOrText(res);
    if (!res.ok) {
      const detail = extractErrorDetail(json, text);
      return { ok: false, raw: { status: res.status, detail } };
    }
    return { ok: true, raw: json ?? text };
  } catch (err) {
    return { ok: false, raw: { error: (err as Error).message } };
  }
}

/**
 * Lädt ein PDF mit einfachem Timeout. Nutzt KEINE Retries und wird in
 * diesem Schritt nicht in bestehende Functions eingebaut.
 */
export async function downloadEsignaturesPdf(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<Uint8Array> {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("Ungültige PDF-URL");
  }
  const timeoutMs = options.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`PDF-Download fehlgeschlagen: ${res.status} ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    clearTimeout(timer);
  }
}