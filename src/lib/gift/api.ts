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

/** Öffentlicher Shop-Status (Server-Env GIFT_LEGAL_APPROVED, Edge Function gift-shop-config). */
export interface GiftShopConfig {
  legal_approved: boolean;
  /** freigegeben ODER Stripe-Testmodus: nur dann nimmt der Server Bestellungen an */
  orderable: boolean;
}

export async function fetchGiftShopConfig(): Promise<GiftShopConfig> {
  const { data, error } = await supabase.functions.invoke("gift-shop-config", { method: "GET" });
  if (error || !data) throw new Error("shop_config_unavailable");
  return data as GiftShopConfig;
}

export interface CreateGiftOrderInput {
  items: { variant_id: string; qty: number }[];
  customer: { name: string; email: string; phone: string };
  handover: "pickup" | "delivery" | "with_catering";
  /** nur bei handover 'with_catering' (Mischbestellung): Bestellnummer der Catering-Bestellung */
  catering_order_number?: string;
  date: string;
  time: string;
  address: { street: string; zip: string; city: string; note: string };
  payment_method: "online" | "on_site";
  gift_message: string;
  age_confirmed: boolean;
  agb_accepted: boolean;
  language: "de" | "en";
  /** Honeypot (unsichtbar, immer leer senden; Bots füllen es). */
  website: string;
  /** Zeitpunkt (ms), an dem das Formular geöffnet wurde: Mindest-Ausfüllzeit wird serverseitig geprüft. */
  form_started_at: number;
}

export interface CreateGiftOrderResult {
  url?: string;
  /** "vor Ort zahlen": Bestätigungslink per E-Mail verschickt; reserviert ist erst nach dem Klick */
  awaiting_confirmation?: boolean;
  order_number: string | null;
  total_cents: number;
  delivery_fee_cents?: number;
  /** nur Mischbestellung (with_catering): ID/Positionen für die Catering-Zahlung */
  gift_order_id?: string;
  items?: { name: string; variant: string; qty: number; unit_price_cents: number }[];
}

export const createGiftOrder = (input: CreateGiftOrderInput) =>
  invoke<CreateGiftOrderResult>("create-gift-order", input as unknown as Record<string, unknown>);

export type ConfirmStatus = "confirmed" | "already_confirmed" | "expired" | "invalid";

/** Löst den Bestätigungslink ein ("vor Ort zahlen", Double-Opt-in). */
export const confirmGiftReservation = (token: string) => invoke<{ status: ConfirmStatus }>("confirm-gift-reservation", { token });
