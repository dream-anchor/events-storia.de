// Typen des öffentlichen Geschenkkorb-Katalogs (Rückgabe von gift_public_catalog / gift_public_settings).
import type { BlackoutDate, DeliveryWindow, PickupHours } from "./pricing";

export interface GiftVariant {
  id: string;
  key: string;
  label_de: string;
  label_en: string;
  image_url: string | null;
  /** Standard: unbegrenzter Bestand (Körbe werden nachgemacht); keine Stückzahl anzeigen */
  unlimited: boolean;
  /** verfügbarer Bestand (Lager minus aktive Reservierungen); null = unbegrenzt, 0 = ausverkauft (vom Betreiber gesetzt) */
  available: number | null;
  net_content: string | null;
  abv_percent: number | null;
  bottler: string | null;
  origin: string | null;
  contains_sulfites: boolean;
  lmiv_complete: boolean;
}

export interface GiftComponent {
  name_de: string;
  name_en: string;
  quantity: string | null;
  ingredients_de: string | null;
  ingredients_en: string | null;
  allergens: string[];
  net_content: string | null;
  food_business_operator: string | null;
  origin: string | null;
  lmiv_complete: boolean;
}

export interface GiftBasket {
  id: string;
  slug: string;
  size_key: string;
  name_de: string;
  name_en: string;
  description_de: string | null;
  description_en: string | null;
  packaging_de: string | null;
  packaging_en: string | null;
  image_url: string | null;
  price_cents: number;
  sort_order: number;
  variants: GiftVariant[];
  components: GiftComponent[];
}

export interface GiftPublicSettings {
  origin_label: string;
  pickup_hours: PickupHours;
  pickup_lead_minutes: number;
  delivery_lead_days: number;
  delivery_windows: DeliveryWindow[];
  min_fee_cents: number;
  blackout_dates: BlackoutDate[];
}

export interface CartLine {
  variantId: string;
  qty: number;
}
