import { supabase } from "@/integrations/supabase/client";
import type { GiftBasket, GiftPublicSettings } from "./types";

export async function fetchGiftCatalog(): Promise<GiftBasket[]> {
  const { data, error } = await supabase.rpc("gift_public_catalog");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GiftBasket[];
}

export async function fetchGiftSettings(): Promise<GiftPublicSettings> {
  const { data, error } = await supabase.rpc("gift_public_settings");
  if (error || !data) throw new Error(error?.message ?? "settings_missing");
  return data as unknown as GiftPublicSettings;
}

/** Fehler der Edge Functions: `code` ist der Fehlercode aus dem JSON-Body (z. B. sold_out, invalid_schedule). */
export class GiftApiError extends Error {
  constructor(public code: string, public details: Record<string, unknown> = {}) {
    super(code);
  }
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // FunctionsHttpError trägt die Response in error.context; dort steht {error: "<code>", ...}
    let payload: Record<string, unknown> = {};
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        payload = await ctx.json();
      } catch {
        /* kein JSON */
      }
    }
    throw new GiftApiError(String(payload.error ?? "network_error"), payload);
  }
  return data as T;
}

export interface DeliveryQuote {
  estimated: true;
  distance_km: number;
  estimated_fee_cents: number;
  vat_rate: number;
}

export const quoteDelivery = (address: { street: string; zip: string; city: string }) =>
  invoke<DeliveryQuote>("gift-delivery-quote", address);

export interface CreateGiftOrderInput {
  items: { variant_id: string; qty: number }[];
  customer: { name: string; email: string; phone: string };
  handover: "pickup" | "delivery";
  date: string;
  time: string;
  address: { street: string; zip: string; city: string; note: string };
  payment_method: "online" | "on_site";
  gift_message: string;
  age_confirmed: boolean;
  agb_accepted: boolean;
  language: "de" | "en";
  test: boolean;
}

export interface CreateGiftOrderResult {
  url?: string;
  reserved?: boolean;
  order_number: string;
  total_cents: number;
  delivery_fee_cents?: number;
}

export const createGiftOrder = (input: CreateGiftOrderInput) =>
  invoke<CreateGiftOrderResult>("create-gift-order", input as unknown as Record<string, unknown>);
