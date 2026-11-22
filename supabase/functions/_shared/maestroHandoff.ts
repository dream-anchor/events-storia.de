// ─── MAESTRO 2.0 Handoff — geteiltes Modul ───────────────────────────────
// Additiv zu bestehendem v1-Stripe-Webhook.
// Enqueue ist synchron (awaitet), HTTP-Zustellung erfolgt asynchron über
// die Outbox (Cron: deliver-maestro-handoff).
// Fail-closed über MAESTRO_HANDOFF_ENABLED=="true".

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
  // Shop-Felder (MAESTRO Einheit M, optional, rückwärtskompatibel). Nie null, leere Werte fehlen.
  orderKind?: MaestroOrderKind;
  lines?: MaestroLine[];
  handover?: "pickup" | "delivery";
  handoverDate?: string;
  handoverTime?: string;
  deliveryAddress?: string | Record<string, string | number | boolean>;
  deliveryFeeCents?: number;
  paymentStatus?: string;
  giftMessage?: string;
  ageConfirmed?: boolean;
}

export type MaestroOrderKind = "catering" | "voucher" | "gift_basket";

export interface MaestroLine {
  name: string;
  variant?: string;
  qty: number;
  unitCents: number;
  vatRate?: number;
}

export type MaestroShopFields = Pick<
  MaestroOrderPayload,
  | "orderKind" | "lines" | "handover" | "handoverDate" | "handoverTime" | "deliveryAddress"
  | "deliveryFeeCents" | "paymentStatus" | "giftMessage" | "ageConfirmed"
>;

// Grenzen == MAESTRO-Zod-Schema (maestro-cloud PR #2091); Body-Limit dort 20 KB.
export const SHOP_MAX_LINES = 50;
export const SHOP_BODY_BUDGET_BYTES = 18_000; // Sicherheitsabstand zum 20-KB-Limit
const NAME_MAX = 120; // bewusst kürzer als das Schema (200), spart Body
const VARIANT_MAX = 100;

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
  /** Optional: Shop-Felder (Positionen, Übergabe …). Fehlt es, entsteht exakt der Altpayload. */
  shop?: MaestroShopFields | null;
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
  if (input.shop) applyShopFields(out, input.shop);
  return out;
}

// ─── Shop-Felder: Bereinigung (rein, deterministisch) ───────────────────
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clipText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  // Zod .max() zählt UTF-16-Einheiten: nach Einheiten kürzen, angeschnittenes High-Surrogate entfernen.
  if (t.length <= max) return t;
  let cut = t.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut;
}

function validIsoDate(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const d = v.slice(0, 10);
  if (!ISO_DATE_RE.test(d) || Number(d.slice(0, 4)) < 2000) return undefined;
  const dt = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d ? d : undefined;
}

/** "9:00", "09:00", "09:00:00", "14:00-16:00" -> "HH:MM" (erste Uhrzeit); sonst weglassen. */
function normalizeTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return undefined;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function sanitizeLine(l: MaestroLine): MaestroLine | null {
  const name = clipText(l?.name, NAME_MAX);
  if (!name) return null;
  if (!Number.isFinite(l.qty) || !Number.isFinite(l.unitCents)) return null;
  const qty = Math.trunc(l.qty);
  const unitCents = Math.round(l.unitCents);
  if (qty < 1 || unitCents < 0 || unitCents > 1_000_000_000) return null;
  const out: MaestroLine = { name, qty: Math.min(qty, 10_000), unitCents };
  const variant = clipText(l.variant, VARIANT_MAX);
  if (variant) out.variant = variant;
  if (typeof l.vatRate === "number" && Number.isFinite(l.vatRate) && l.vatRate >= 0 && l.vatRate <= 100) out.vatRate = l.vatRate;
  return out;
}

function sanitizeAddress(a: MaestroOrderPayload["deliveryAddress"]): MaestroOrderPayload["deliveryAddress"] | undefined {
  if (typeof a === "string") return clipText(a, 1000);
  if (!a || typeof a !== "object") return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const k of Object.keys(a).sort().slice(0, 20)) {
    const v = a[k];
    if (typeof v === "string") {
      const t = clipText(v, 500);
      if (t) out[clipText(k, 60) ?? k] = t;
    } else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Schreibt die Shop-Felder in den Payload. Nie null/undefined/leer; Positionen max. 50 und so viele, dass der
 * Body unter dem Budget bleibt (überzählige werden hinten abgeschnitten). Reine Funktion von (payload, shop).
 */
function applyShopFields(out: MaestroOrderPayload, shop: MaestroShopFields): void {
  if (shop.orderKind === "catering" || shop.orderKind === "voucher" || shop.orderKind === "gift_basket") out.orderKind = shop.orderKind;
  if (shop.handover === "pickup" || shop.handover === "delivery") out.handover = shop.handover;
  const date = validIsoDate(shop.handoverDate);
  if (date) out.handoverDate = date;
  const time = normalizeTime(shop.handoverTime);
  if (time) out.handoverTime = time;
  const addr = sanitizeAddress(shop.deliveryAddress);
  if (addr !== undefined) out.deliveryAddress = addr;
  if (typeof shop.deliveryFeeCents === "number" && Number.isFinite(shop.deliveryFeeCents)) {
    const fee = Math.round(shop.deliveryFeeCents);
    if (fee >= 0 && fee <= 999_999_999) out.deliveryFeeCents = fee;
  }
  const ps = clipText(shop.paymentStatus, 40);
  if (ps) out.paymentStatus = ps;
  const gm = clipText(shop.giftMessage, 500);
  if (gm) out.giftMessage = gm;
  if (typeof shop.ageConfirmed === "boolean") out.ageConfirmed = shop.ageConfirmed;

  if (Array.isArray(shop.lines)) {
    const kept: MaestroLine[] = [];
    let invalid = 0;
    for (const l of shop.lines) {
      const c = sanitizeLine(l);
      if (c) kept.push(c); else invalid++;
    }
    const overflow: MaestroLine[] = [];
    // Max. 50 Positionen; braucht es eine Sammelzeile, zählt sie mit.
    while (kept.length > SHOP_MAX_LINES || (kept.length === SHOP_MAX_LINES && (overflow.length || invalid))) {
      overflow.unshift(kept.pop() as MaestroLine);
    }
    const compose = (): MaestroLine[] => {
      const n = overflow.length + invalid;
      if (!n) return [...kept];
      const rest = overflow.reduce((a, l) => a + l.qty * l.unitCents, 0);
      // Sammelzeile hält die Summe stimmig (Zod: unitCents <= 1e9)
      return [...kept, { name: `weitere Positionen (${n})`, qty: 1, unitCents: Math.min(rest, 1_000_000_000) }];
    };
    if (kept.length) {
      const enc = new TextEncoder();
      out.lines = compose();
      while (kept.length > 1 && enc.encode(stableStringify(out)).byteLength > SHOP_BODY_BUDGET_BYTES) {
        overflow.unshift(kept.pop() as MaestroLine);
        out.lines = compose();
      }
    }
  }
}

// ─── Shop-Felder aus DB-Zeilen (rein, testbar) ──────────────────────────
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const cents = (euro: unknown): number | undefined =>
  typeof euro === "number" && Number.isFinite(euro) ? Math.round(euro * 100) : undefined;
/** Aus dem Stripe-Session-Status (nicht aus der DB): bleibt bei Redelivery identisch. */
export const paymentStatusFromSession = (sessionPaymentStatus: string | null | undefined): string =>
  sessionPaymentStatus === "paid" ? "paid" : "unpaid";

function cateringLines(items: unknown): MaestroLine[] {
  if (!Array.isArray(items)) return [];
  const out: MaestroLine[] = [];
  for (const it of items as Row[]) {
    const unit = cents(it?.price);
    if (unit === undefined) continue;
    out.push({
      name: String(it?.name ?? ""),
      qty: Number(it?.quantity),
      unitCents: unit,
      vatRate: typeof it?.taxRatePercentage === "number" ? it.taxRatePercentage : 7, // Catering-Standard wie create-lexoffice-invoice
    });
  }
  return out;
}

function giftLines(items: Row[] | null | undefined): MaestroLine[] {
  return (items ?? []).map((it) => ({
    name: String(it.basket_name ?? ""),
    variant: `Geschenkkorb – ${String(it.variant_label ?? "")}`,
    qty: Number(it.qty),
    unitCents: Number(it.unit_price_cents),
  }));
}

function addressObject(r: Row): Record<string, string | boolean> | undefined {
  const a: Record<string, string | boolean> = {};
  for (const [k, v] of [["street", r.delivery_street], ["zip", r.delivery_zip], ["city", r.delivery_city], ["floor", r.delivery_floor], ["note", r.delivery_note]] as const) {
    if (typeof v === "string" && v.trim()) a[k] = v.trim();
  }
  if (typeof r.has_elevator === "boolean" && a.floor) a.elevator = r.has_elevator;
  return Object.keys(a).length ? a : undefined;
}

/** Catering (optional mit verknüpftem Geschenkkorb = Mischbestellung: Korb-Positionen als zusätzliche Zeilen). */
export function shopFieldsFromCatering(order: Row, gift: { order: Row; items: Row[] } | null, paymentStatus: string): MaestroShopFields {
  const handover = order.is_pickup === true ? "pickup" : order.is_pickup === false ? "delivery" : undefined;
  const lines = cateringLines(order.items);
  const surcharge = cents(order.minimum_order_surcharge);
  if (surcharge && surcharge > 0) lines.push({ name: "Mindestbestellwert-Aufschlag", qty: 1, unitCents: surcharge, vatRate: 7 });
  if (gift) lines.push(...giftLines(gift.items));
  const fields: MaestroShopFields = { orderKind: "catering", lines, paymentStatus };
  if (handover) fields.handover = handover;
  fields.handoverDate = order.desired_date ?? undefined;
  fields.handoverTime = order.desired_time ?? undefined;
  if (handover !== "pickup") {
    fields.deliveryAddress = addressObject(order) ?? (typeof order.delivery_address === "string" ? order.delivery_address : undefined);
    const fee = (cents(order.delivery_cost) ?? 0) + (gift ? Number(gift.order.delivery_fee_cents) || 0 : 0);
    if (handover === "delivery" || fee > 0) fields.deliveryFeeCents = fee;
  }
  if (gift) {
    fields.giftMessage = gift.order.gift_message ?? undefined;
    fields.ageConfirmed = Boolean(gift.order.age_confirmed_at);
  }
  return fields;
}

/** Reine Korb-Bestellung (gift_orders + gift_order_items). */
export function shopFieldsFromGift(order: Row, items: Row[], paymentStatus: string): MaestroShopFields {
  const handover = order.handover === "pickup" || order.handover === "delivery" ? order.handover : undefined;
  const fields: MaestroShopFields = {
    orderKind: "gift_basket",
    lines: giftLines(items),
    paymentStatus,
    handoverDate: order.handover_date ?? undefined,
    handoverTime: order.handover_time ?? undefined,
    giftMessage: order.gift_message ?? undefined,
    ageConfirmed: Boolean(order.age_confirmed_at),
  };
  if (handover) fields.handover = handover;
  if (handover === "delivery") {
    fields.deliveryAddress = addressObject(order);
    const fee = Number(order.delivery_fee_cents);
    if (Number.isFinite(fee)) fields.deliveryFeeCents = fee;
  }
  return fields;
}

/** Gutschein (digital, keine Übergabe; der Code gehört nicht in den Payload). */
export function shopFieldsFromVoucher(v: Row, paymentStatus: string): MaestroShopFields {
  const amount = Number(v.amount_cents);
  const eur = Number.isFinite(amount) ? (amount / 100).toFixed(2).replace(".", ",") : "";
  return {
    orderKind: "voucher",
    lines: [{ name: eur ? `Gutschein ${eur} EUR` : "Gutschein", qty: 1, unitCents: amount }],
    paymentStatus,
    // bewusst ohne giftMessage (Datenschutz, MAESTRO braucht den Grußtext des Gutscheins nicht)
  };
}

export type ShopFieldsResult =
  | { ok: true; fields: MaestroShopFields | null } // null = keine Shop-Art / Datensatz fehlt -> Altpayload
  | { ok: false; error: string }; // Lesefehler -> Aufrufer nimmt Altpayload (nie die Übergabe verhindern)

/**
 * Liest je metadata.order_type die Positionen etc. aus der DB. Wirft nie.
 * catering -> catering_orders (+ gift_orders/-items bei Mischbestellung), gift_basket -> gift_orders/-items,
 * voucher -> vouchers. Alles andere -> fields null.
 */
export async function loadShopFields(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  md: Record<string, string>,
  sessionPaymentStatus: string | null | undefined,
): Promise<ShopFieldsResult> {
  try {
    const ps = paymentStatusFromSession(sessionPaymentStatus);
    const loadGift = async (id: string) => {
      const { data: order, error } = await supabase.from("gift_orders").select(
        "handover, handover_date, handover_time, delivery_street, delivery_zip, delivery_city, delivery_note, delivery_fee_cents, gift_message, age_confirmed_at",
      ).eq("id", id).maybeSingle();
      if (error) throw new Error(`gift_orders: ${error.message}`);
      if (!order) return null;
      // Stabile Reihenfolge, sonst ändert sich der Payload-Hash bei Redelivery
      const { data: items, error: iErr } = await supabase.from("gift_order_items")
        .select("basket_name, variant_label, qty, unit_price_cents").eq("order_id", id)
        .order("created_at", { ascending: true }).order("id", { ascending: true });
      if (iErr) throw new Error(`gift_order_items: ${iErr.message}`);
      return { order: order as Row, items: (items ?? []) as Row[] };
    };

    if (md.order_type === "catering" && md.order_number) {
      const { data: order, error } = await supabase.from("catering_orders").select(
        "items, is_pickup, desired_date, desired_time, delivery_address, delivery_street, delivery_zip, delivery_city, delivery_floor, has_elevator, delivery_cost, minimum_order_surcharge",
      ).eq("order_number", md.order_number).maybeSingle();
      if (error) throw new Error(`catering_orders: ${error.message}`);
      if (!order) return { ok: true, fields: null };
      const gift = md.gift_order_id ? await loadGift(md.gift_order_id) : null;
      if (md.gift_order_id && !gift) return { ok: false, error: "linked gift order not found" };
      return { ok: true, fields: shopFieldsFromCatering(order, gift, ps) };
    }
    if (md.order_type === "gift_basket" && md.gift_order_id) {
      const gift = await loadGift(md.gift_order_id);
      return { ok: true, fields: gift ? shopFieldsFromGift(gift.order, gift.items, ps) : null };
    }
    if (md.order_type === "voucher" && md.voucher_id) {
      const { data: v, error } = await supabase.from("vouchers").select("amount_cents").eq("id", md.voucher_id).maybeSingle();
      if (error) throw new Error(`vouchers: ${error.message}`);
      return { ok: true, fields: v ? shopFieldsFromVoucher(v, ps) : null };
    }
    return { ok: true, fields: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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
