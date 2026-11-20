import { parseTariff, type BlackoutDate, type DeliveryTariff, type DeliveryWindow, type PickupHours, type ScheduleSettings } from "./giftPricing.ts";

// deno-lint-ignore no-explicit-any
type Supa = any;

export interface GiftSettings {
  origin: { lat: number; lng: number; label: string };
  tariff: DeliveryTariff;
  schedule: ScheduleSettings;
  delivery_vat_rate: number;
  hold_minutes: number;
  notify_email: string;
}

/** Lädt gift_settings (Tarif, Termine, Hold) – einzige Quelle der Tarifwerte (kein Hardcode im Funktionscode). */
export async function loadGiftSettings(supabase: Supa): Promise<GiftSettings> {
  const { data, error } = await supabase.from("gift_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("gift_settings_missing");
  return {
    origin: { lat: Number(data.origin_lat), lng: Number(data.origin_lng), label: data.origin_label },
    tariff: parseTariff(data),
    schedule: {
      pickup_hours: (data.pickup_hours ?? {}) as PickupHours,
      pickup_lead_minutes: Number(data.pickup_lead_minutes),
      delivery_lead_days: Number(data.delivery_lead_days),
      delivery_windows: (Array.isArray(data.delivery_windows) ? data.delivery_windows : []) as DeliveryWindow[],
    },
    delivery_vat_rate: Number(data.delivery_vat_rate),
    hold_minutes: Number(data.hold_minutes),
    notify_email: data.order_notify_email,
  };
}

export async function loadBlackoutDates(supabase: Supa, fromDate: string): Promise<BlackoutDate[]> {
  const { data } = await supabase.from("gift_blackout_dates").select("date, handover").gte("date", fromDate);
  return (data ?? []) as BlackoutDate[];
}
