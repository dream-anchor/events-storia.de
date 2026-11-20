/**
 * Geschenkkorb-Lieferung: Straßenentfernung ab Karlstraße 47a über OpenRouteService.
 * Kopie des Aufrufmusters aus calculate-delivery (Geocoding + Directions); calculate-delivery bleibt unverändert,
 * damit Catering unberührt ist. Gemeinsam genutzt von gift-delivery-quote und create-gift-order (Neuberechnung).
 */
import { haversineKm } from "./giftPricing.ts";

export type RoutingErrorCode = "address_not_found" | "too_far" | "routing_unavailable" | "not_configured";

export class RoutingError extends Error {
  constructor(public code: RoutingErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface DeliveryAddress {
  street: string;
  zip: string;
  city: string;
}

/** Luftlinie, ab der kein Routing-Aufruf mehr gemacht wird (Schutz vor ORS-Kostenmissbrauch, kein Liefergebiet). */
export const MAX_AIR_DISTANCE_KM = 250;

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      console.error("[GIFT-ROUTING] ORS error", res.status, (await res.text()).slice(0, 200));
      throw new RoutingError(res.status === 400 || res.status === 404 ? "address_not_found" : "routing_unavailable");
    }
    return await res.json();
  } catch (e) {
    if (e instanceof RoutingError) throw e;
    throw new RoutingError("routing_unavailable", e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

/** Einfache Straßenentfernung in km (ungerundet) vom Ursprung zur Lieferadresse. Wirft RoutingError. */
export async function resolveDistanceKm(
  address: DeliveryAddress,
  origin: { lat: number; lng: number },
  apiKey: string | undefined,
): Promise<number> {
  if (!apiKey) throw new RoutingError("not_configured");

  const text = `${address.street}, ${address.zip} ${address.city}`;
  const geo = (await fetchJson(
    `https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}` +
      `&boundary.country=DE&size=1&focus.point.lat=${origin.lat}&focus.point.lon=${origin.lng}`,
  )) as { features?: { geometry?: { coordinates?: [number, number] }; properties?: { layer?: string; confidence?: number } }[] };

  const f = geo.features?.[0];
  const coords = f?.geometry?.coordinates;
  // Nur straßen-/hausgenaue Treffer; ein reiner Ortstreffer würde einen falschen Preis liefern
  if (!coords || !["address", "street", "venue"].includes(f?.properties?.layer ?? "") || (f?.properties?.confidence ?? 0) < 0.5) {
    throw new RoutingError("address_not_found");
  }
  const [destLng, destLat] = coords;

  if (haversineKm(origin.lat, origin.lng, destLat, destLng) > MAX_AIR_DISTANCE_KM) {
    throw new RoutingError("too_far");
  }

  const dir = (await fetchJson("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [[origin.lng, origin.lat], [destLng, destLat]] }),
  })) as { routes?: { summary?: { distance?: number } }[] };

  const meters = dir.routes?.[0]?.summary?.distance;
  if (typeof meters !== "number" || !(meters >= 0)) throw new RoutingError("routing_unavailable");
  return meters / 1000;
}
