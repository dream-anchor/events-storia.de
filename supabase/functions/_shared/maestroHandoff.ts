// ─── MAESTRO 2.0 Handoff — geteiltes Modul ───────────────────────────────
// Additiv zu bestehendem v1-Stripe-Webhook.
// Enqueue ist synchron (awaitet), HTTP-Zustellung erfolgt asynchron über
// die Outbox (Cron: deliver-maestro-handoff).
// Fail-closed über MAESTRO_HANDOFF_ENABLED=="true".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type MaestroTxnKind = "charge" | "refund" | "chargeback";
export type MaestroPaymentType = "deposit" | "prepayment" | "final" | "full";

export interface MaestroTransaction {
  provider: "stripe";
  providerTransactionId: string;
  providerEventId?: string;
  txnKind: MaestroTxnKind;
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded" | "canceled";
  amountCents: number;
  currency: string;
  paymentType?: MaestroPaymentType;
  occurredAt: string;
}

export interface MaestroOrderPayload {
  deliveryEventId: string;
  sourceSystem: "events-storia-v1";
  sourceOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  company?: string;
  phone?: string;
  amountTotalCents: number;
  eventDate?: string;
  guests?: number;
  occasion?: string;
  message?: string;
  transaction?: MaestroTransaction;
}

// ─── Feature-Flag ────────────────────────────────────────────────────────
// Fail-closed: nur explizit "true" aktiviert. Alles andere (fehlend, "false",
// "1", "TRUE") ist deaktiviert.
export function handoffEnabled(): boolean {
  return Deno.env.get("MAESTRO_HANDOFF_ENABLED") === "true";
}

// ─── HMAC-Signatur ───────────────────────────────────────────────────────
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signBody(rawBody: string, secret: string): Promise<{ header: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return { header: `t=${timestamp},v1=${sig}`, timestamp };
}

// ─── Konstante-Zeit-Vergleich für Secrets ────────────────────────────────
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  try {
    // Deno >=1.25
    // deno-lint-ignore no-explicit-any
    return (crypto as any).timingSafeEqual ? (crypto as any).timingSafeEqual(aa, bb) : slowEq(aa, bb);
  } catch {
    return slowEq(aa, bb);
  }
}
function slowEq(a: Uint8Array, b: Uint8Array): boolean {
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

// ─── Payload-Serialisierung (kanonisch, deterministisch) ────────────────
// Der genau signierte Byte-String wird persistiert und bei jedem Retry
// bytegenau wiederverwendet (Punkt 4 der Vorgaben).
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const inner = keys
    .map((k) => {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) return null;
      return `${JSON.stringify(k)}:${stableStringify(v)}`;
    })
    .filter((x) => x !== null)
    .join(",");
  return `{${inner}}`;
}

// ─── Payload-Builder ─────────────────────────────────────────────────────
export function buildOrderPayload(input: {
  deliveryEventId: string;
  sourceOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  company?: string | null;
  phone?: string | null;
  amountTotalCents: number;
  eventDate?: string | null;
  guests?: number | null;
  occasion?: string | null;
  message?: string | null;
  transaction?: MaestroTransaction;
}): MaestroOrderPayload {
  const out: MaestroOrderPayload = {
    deliveryEventId: input.deliveryEventId,
    sourceSystem: "events-storia-v1",
    sourceOrderId: input.sourceOrderId,
    orderNumber: input.orderNumber,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    amountTotalCents: input.amountTotalCents,
  };
  if (input.company) out.company = input.company;
  if (input.phone) out.phone = input.phone;
  if (input.eventDate) out.eventDate = input.eventDate;
  if (typeof input.guests === "number") out.guests = input.guests;
  if (input.occasion) out.occasion = input.occasion;
  if (input.message) out.message = input.message;
  if (input.transaction) out.transaction = input.transaction;
  return out;
}

// ─── Enqueue in Outbox ───────────────────────────────────────────────────
// Muss awaitet werden. Kollisionen (gleiche delivery_event_id):
//  • gleicher payload_hash → idempotenter No-Op
//  • anderer payload_hash → status='conflict', nichts überschreiben
export type EnqueueResult =
  | { ok: true; status: "inserted" | "duplicate" }
  | { ok: false; status: "conflict"; existingId: string }
  | { ok: false; status: "disabled" };

// deno-lint-ignore no-explicit-any
export async function enqueueMaestroHandoff(
  supabase: ReturnType<typeof createClient>,
  payload: MaestroOrderPayload,
): Promise<EnqueueResult> {
  if (!handoffEnabled()) return { ok: false, status: "disabled" };

  const rawBody = stableStringify(payload);
  const payloadHash = await sha256Hex(rawBody);

  // Try insert; on unique conflict fetch and compare hash.
  const { error: insertErr } = await supabase.from("maestro_handoff_outbox").insert({
    delivery_event_id: payload.deliveryEventId,
    source_system: payload.sourceSystem,
    source_order_id: payload.sourceOrderId,
    payload: payload as unknown as Record<string, unknown>,
    raw_body: rawBody,
    payload_hash: payloadHash,
    status: "pending",
  });

  if (!insertErr) return { ok: true, status: "inserted" };

  // duplicate key or something else
  const { data: existing } = await supabase
    .from("maestro_handoff_outbox")
    .select("id, payload_hash, status")
    .eq("delivery_event_id", payload.deliveryEventId)
    .maybeSingle();

  if (!existing) throw new Error(`enqueue failed: ${insertErr.message}`);

  if (existing.payload_hash === payloadHash) return { ok: true, status: "duplicate" };

  // Conflict — anderer Payload für gleiche Delivery-ID. Nichts überschreiben.
  await supabase
    .from("maestro_handoff_outbox")
    .update({ status: "conflict", last_error: "payload_hash_mismatch_on_reenqueue" })
    .eq("id", existing.id)
    .neq("status", "sent");

  return { ok: false, status: "conflict", existingId: existing.id as string };
}

// ─── HTTP-Zustellung an MAESTRO ─────────────────────────────────────────
export interface DeliveryResult {
  ok: boolean;
  httpStatus: number;
  maestroEventId?: string;
  maestroPaymentId?: string;
  errorCode?: string;
  isTransient: boolean;
  isAuth: boolean;
  isConflict: boolean;
}

export async function postToMaestro(
  rawBody: string,
  secret: string,
  url: string,
): Promise<DeliveryResult> {
  const { header } = await signBody(rawBody, secret);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Maestro-Signature": header },
      body: rawBody,
    });
  } catch (err) {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: err instanceof Error ? err.name : "network_error",
      isTransient: true,
      isAuth: false,
      isConflict: false,
    };
  }

  // MAESTRO antwortet { data: {...} } (Erfolg) bzw. { error: <code> } (Fehler);
  // aeltere Annahme (top-level eventId/errorCode) bleibt als Fallback bestehen.
  let json: { eventId?: string; paymentId?: string; errorCode?: string; error?: string; data?: { eventId?: string; paymentId?: string; inquiryId?: string } } = {};
  try {
    json = await res.json();
  } catch { /* body optional */ }

  return {
    ok: res.ok,
    httpStatus: res.status,
    maestroEventId: json.data?.eventId ?? json.data?.inquiryId ?? json.eventId,
    maestroPaymentId: json.data?.paymentId ?? json.paymentId,
    errorCode: json.error ?? json.errorCode,
    isTransient: res.status >= 500 || res.status === 408 || res.status === 429,
    isAuth: res.status === 401 || res.status === 403,
    isConflict: res.status === 409,
  };
}

// ─── Backoff ────────────────────────────────────────────────────────────
// 1m, 5m, 15m, 1h, 6h, 24h — nach Versuch #6 → failed.
export const BACKOFF_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60, 6 * 60 * 60, 24 * 60 * 60];
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length;
