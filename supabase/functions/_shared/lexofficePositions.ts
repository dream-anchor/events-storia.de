// Rein lesender Abruf von Beleg-Positionen aus Lexoffice für die USt-Prüfung alter Rechnungen.
// Ausschließlich GET gegen Lexoffice, keine Datenbankzugriffe in diesem Modul.
// Datensparsamkeit: Die Ausgabe wird Feld für Feld aufgebaut (Whitelist). Adresse, Kontakt,
// Einleitungs-/Schlusstext, Positionsbeschreibungen und Textzeilen werden nie weitergegeben.

// Quelle: https://developers.lexware.io/docs/ (Abschnitt "API Gateway")
const LEX_BASE = "https://api.lexware.io/v1";

// Quelle: https://developers.lexware.io/docs/#api-rate-limits — höchstens 2 Anfragen je Sekunde,
// gemeinsam über alle Endpunkte. 600 ms Abstand lassen Luft für die übrigen Functions am selben Key.
export const REQUEST_SPACING_MS = 600;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 10_000;
// Häppchen, damit ein Aufruf auch mit Wiederholungen deutlich unter dem Function-Timeout bleibt.
export const MAX_IDS_PER_CALL = 10;

const ENDPOINTS = {
  invoice: "invoices",
  downpayment: "down-payment-invoices",
  quotation: "quotations",
} as const;
export type VoucherKind = keyof typeof ENDPOINTS;
const KINDS = Object.keys(ENDPOINTS) as VoucherKind[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VoucherRequest { id: string; type: VoucherKind }

export interface Deps {
  apiKey: string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
}

/** Erwartet { vouchers: [{ id, type? }] }. Wirft bei ungültiger Eingabe. */
export function parseRequest(body: unknown): VoucherRequest[] {
  const list = (body as { vouchers?: unknown } | null)?.vouchers;
  if (!Array.isArray(list) || list.length === 0) throw new Error("vouchers: nicht leere Liste erwartet");
  if (list.length > MAX_IDS_PER_CALL) throw new Error(`vouchers: höchstens ${MAX_IDS_PER_CALL} je Aufruf`);
  return list.map((v) => {
    const { id, type = "invoice" } = (v ?? {}) as { id?: unknown; type?: unknown };
    // UUID-Prüfung verhindert, dass über die ID ein anderer Lexoffice-Pfad angesprochen wird.
    if (typeof id !== "string" || !UUID.test(id)) throw new Error("vouchers[].id: UUID erwartet");
    if (!KINDS.includes(type as VoucherKind)) throw new Error(`vouchers[].type: ${KINDS.join(" | ")}`);
    return { id, type: type as VoucherKind };
  });
}

// deno-lint-ignore no-explicit-any
export function reduceVoucher(data: any) {
  // deno-lint-ignore no-explicit-any
  const lines: any[] = Array.isArray(data?.lineItems) ? data.lineItems : [];
  return {
    voucherNumber: data?.voucherNumber ?? null,
    voucherDate: data?.voucherDate ?? null,
    voucherStatus: data?.voucherStatus ?? null,
    taxType: data?.taxConditions?.taxType ?? null,
    totalNetAmount: data?.totalPrice?.totalNetAmount ?? null,
    totalGrossAmount: data?.totalPrice?.totalGrossAmount ?? null,
    totalTaxAmount: data?.totalPrice?.totalTaxAmount ?? null,
    totalDiscountAbsolute: data?.totalPrice?.totalDiscountAbsolute ?? null,
    totalDiscountPercentage: data?.totalPrice?.totalDiscountPercentage ?? null,
    taxAmounts: (data?.taxAmounts ?? []).map((t: Record<string, unknown>) => ({
      taxRatePercentage: t.taxRatePercentage ?? null,
      netAmount: t.netAmount ?? null,
      taxAmount: t.taxAmount ?? null,
    })),
    positions: lines.filter((l) => l?.type !== "text").map((l) => ({
      name: l.name ?? null,
      quantity: l.quantity ?? null,
      unitNetAmount: l.unitPrice?.netAmount ?? null,
      unitGrossAmount: l.unitPrice?.grossAmount ?? null,
      taxRatePercentage: l.unitPrice?.taxRatePercentage ?? null,
      discountPercentage: l.discountPercentage ?? null,
      // netto oder brutto, je nach taxType
      lineItemAmount: l.lineItemAmount ?? null,
    })),
    // Hilft, zu einem Angebot die zugehörige Rechnung zu finden.
    relatedVouchers: (data?.relatedVouchers ?? []).map((r: Record<string, unknown>) => ({
      id: r.id ?? null,
      voucherType: r.voucherType ?? null,
      voucherNumber: r.voucherNumber ?? null,
    })),
  };
}

export class LexofficeAuthError extends Error {}

export async function fetchVouchers(requests: VoucherRequest[], deps: Deps) {
  let first = true;
  const get = async (path: string): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
      if (!first) await deps.sleep(REQUEST_SPACING_MS);
      first = false;
      const res = await deps.fetch(`${LEX_BASE}/${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${deps.apiKey}`, Accept: "application/json" },
      });
      if ((res.status !== 429 && res.status < 500) || attempt === MAX_ATTEMPTS) return res;
      await res.body?.cancel();
      const retryAfter = Number(res.headers.get("Retry-After")) * 1000;
      await deps.sleep(Math.min(retryAfter > 0 ? retryAfter : 2000 * attempt, MAX_RETRY_WAIT_MS));
    }
  };

  const results = [];
  for (const { id, type } of requests) {
    // Die Belegart der Prüfliste ist nicht immer sicher: bei 404 die anderen Endpunkte probieren.
    const order = [type, ...KINDS.filter((k) => k !== type)];
    let result: Record<string, unknown> = { id, ok: false, error: "Nicht gefunden" };
    for (const kind of order) {
      try {
        const res = await get(`${ENDPOINTS[kind]}/${id}`);
        if (res.ok) {
          result = { id, ok: true, type: kind, ...reduceVoucher(await res.json()) };
          break;
        }
        // Antworttext nicht weiterreichen: er kann Kundendaten enthalten.
        await res.body?.cancel();
        if (res.status === 401 || res.status === 403) {
          throw new LexofficeAuthError(`Lexoffice lehnt den Zugriff ab (${res.status})`);
        }
        if (res.status !== 404) {
          result = { id, ok: false, error: `Lexoffice-Fehler ${res.status}` };
          break;
        }
      } catch (e) {
        if (e instanceof LexofficeAuthError) throw e;
        result = { id, ok: false, error: "Abruf fehlgeschlagen" };
        break;
      }
    }
    results.push(result);
  }
  return results;
}
