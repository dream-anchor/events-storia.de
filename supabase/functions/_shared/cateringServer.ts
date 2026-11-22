// Catering-Preisprüfung: I/O-Teile (Katalog laden, Entfernung per OpenRouteService).
// Reine Rechenlogik: cateringPricing.ts.
import type { Catalog } from "./cateringPricing.ts";
import { EVENT_ID_PREFIX, buildOrderQuote, type QuoteOutcome, type QuotePackage, type QuoteRequestItem } from "./orderQuote.ts";
import { CHAFING_DISH_ID } from "./cateringPricing.ts";

/** Mandant dieser Website (events-storia.de). Katalog und Pakete werden darauf begrenzt (tenant_id NULL zählt als Default). */
export const CATALOG_TENANT_ID = "00000000-0000-0000-0000-000000000001"; // = DEFAULT_TENANT_ID in tenant.ts
const TENANT_FILTER = `tenant_id.eq.${CATALOG_TENANT_ID},tenant_id.is.null`;

const RESTAURANT_COORDS = { lat: 48.1431, lng: 11.5606 }; // wie calculate-delivery/index.ts

// deno-lint-ignore no-explicit-any
type Supa = any;

/** menu_items (+ Menü-Slug über menu_categories/menus) zu den gegebenen IDs. IDs ohne UUID-Form werden übersprungen. */
export async function loadCatalog(supabase: Supa, ids: string[]): Promise<Catalog> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const wanted = [...new Set(ids.filter((i) => uuid.test(i)))];
  const catalog: Catalog = {};
  if (wanted.length === 0) return catalog;
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, name_en, price, category_id, deleted_at, archived_at")
    .or(TENANT_FILTER)
    .in("id", wanted);
  if (error) throw new Error(`catalog_load_failed: ${error.message}`);
  const catIds = [...new Set((items ?? []).map((i: { category_id: string }) => i.category_id).filter(Boolean))];
  const menuByCat = new Map<string, string>(); // nur aktive Kategorien (wie useCateringMenus: deleted_at/archived_at IS NULL)
  const slugByMenu = new Map<string, string | null>(); // nur veröffentlichte Catering-Menüs
  if (catIds.length > 0) {
    const { data: cats, error: cErr } = await supabase
      .from("menu_categories").select("id, menu_id").or(TENANT_FILTER).in("id", catIds).is("deleted_at", null).is("archived_at", null);
    if (cErr) throw new Error(`catalog_load_failed: ${cErr.message}`);
    const menuIds = [...new Set((cats ?? []).map((c: { menu_id: string }) => c.menu_id))];
    if (menuIds.length > 0) {
      const { data: menus, error: mErr } = await supabase
        .from("menus").select("id, slug").or(TENANT_FILTER).in("id", menuIds).eq("menu_type", "catering").eq("is_published", true);
      if (mErr) throw new Error(`catalog_load_failed: ${mErr.message}`);
      for (const m of menus ?? []) slugByMenu.set(m.id, m.slug);
      for (const c of cats ?? []) if (slugByMenu.has(c.menu_id)) menuByCat.set(c.id, c.menu_id);
    }
  }
  for (const i of items ?? []) {
    const menuId = menuByCat.get(i.category_id);
    catalog[i.id] = {
      price: i.price === null || i.price === undefined ? null : Number(i.price),
      // nicht verkäuflich: Artikel gelöscht/archiviert ODER Kategorie weg ODER Menü nicht veröffentlicht/kein Catering
      active: !i.deleted_at && !i.archived_at && menuId !== undefined,
      menuSlug: menuId !== undefined ? slugByMenu.get(menuId) ?? null : null,
      name: i.name,
      nameEn: i.name_en,
    };
  }
  return catalog;
}

/** Eventpakete (nur dieser Mandant) zu den gegebenen IDs. Inaktive Pakete werden mitgeliefert (is_active=false), die Quote lehnt sie ab. */
export async function loadPackages(supabase: Supa, ids: string[]): Promise<Record<string, QuotePackage>> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const wanted = [...new Set(ids.filter((i) => uuid.test(i)))];
  const out: Record<string, QuotePackage> = {};
  if (wanted.length === 0) return out;
  const { data, error } = await supabase
    .from("packages")
    .select("id, name, name_en, price, price_per_person, is_active, min_guests, max_guests")
    .or(TENANT_FILTER)
    .in("id", wanted);
  if (error) throw new Error(`packages_load_failed: ${error.message}`);
  for (const p of data ?? []) out[p.id] = { ...p, price: Number(p.price) };
  return out;
}

/** Einweg-Straßenkilometer ab Karlstr. 47a (Geocoding + Directions wie calculate-delivery). null bei jedem Fehler. */
export async function oneWayDistanceKm(address: string, apiKey: string | undefined, fetchFn: typeof fetch = fetch): Promise<number | null> {
  if (!apiKey || address.trim().length < 5) return null;
  try {
    const g = await fetchFn(`https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&boundary.country=DE`, { signal: AbortSignal.timeout(8000) });
    if (!g.ok) return null;
    const gj = await g.json();
    const coords = gj.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const [lng, lat] = coords;
    const d = await fetchFn("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[RESTAURANT_COORDS.lng, RESTAURANT_COORDS.lat], [lng, lat]] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!d.ok) return null;
    const meters = (await d.json()).routes?.[0]?.summary?.distance;
    // 0 m ist eine gültige Entfernung (Lieferadresse = Restaurant); nur fehlende/negative Werte gelten als Fehler
    return typeof meters === "number" && Number.isFinite(meters) && meters >= 0 ? meters / 1000 : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entfernungs-Cache und Budget (OpenRouteService kostet Kontingent; das Angebot ist öffentlich aufrufbar)
// ---------------------------------------------------------------------------
import { rateLimited } from "./giftRateLimit.ts";

const MEM_TTL_MS = 24 * 3600_000;
const MEM_MAX = 2000;
const DB_TTL_MS = 30 * 24 * 3600_000;
const memCache = new Map<string, { km: number; at: number }>();
const budget = { day: "", count: 0 };
const env = (k: string): string | undefined => { try { return Deno.env.get(k) ?? undefined; } catch { return undefined; } };
/** ORS-Aufrufe je Tag (Geocoding + Routing einzeln). Standard bewusst unter dem Tarif; Env ORS_DAILY_BUDGET überschreibt. */
const dailyBudget = (): number => Number(env("ORS_DAILY_BUDGET") ?? "") || 1800;
/** Cache-Fehltreffer (= ORS-Aufrufe) je Client und Stunde */
export const ORS_MISSES_PER_CLIENT_HOUR = 10;
/** Tageswechsel des Budgets um Mitternacht Europe/Berlin (ORS-Kontingent und DB-Zähler zählen nach Berliner Datum, nicht UTC). */
export const berlinDay = (now: Date): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
/** Erschöpfungs-Alarm höchstens einmal je Stunde und Instanz (sonst eine ::error-Zeile je Anfrage). */
const ALARM_INTERVAL_MS = 3600_000;
let lastBudgetAlarm = 0;
function alarmBudgetExhausted(msg: string, nowMs = Date.now()): void {
  if (nowMs - lastBudgetAlarm < ALARM_INTERVAL_MS) return;
  lastBudgetAlarm = nowMs;
  console.error(msg);
}

/** Adresse normalisieren: gleiche Adresse in anderer Schreibweise trifft denselben Cache-Eintrag. */
export const addressCacheKey = (address: string): string =>
  address.toLowerCase().replace(/[,.;]/g, " ").replace(/\s+/g, " ").trim();

/** Schlüssel in der Tabelle: sha256(Pepper | Adresse), nie Klartext. Ohne Pepper null = kein persistenter Cache (DSGVO). */
export async function hashedCacheKey(normalized: string, pepper: string | undefined): Promise<string | null> {
  if (!pepper) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pepper}|${normalized}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Budget je Instanz (Rückfall, wenn der globale DB-Zähler nicht erreichbar ist). ::error-Zeile bei Erschöpfung. */
export function takeOrsBudget(calls: number, now = new Date(), limit = dailyBudget()): boolean {
  const day = berlinDay(now);
  if (budget.day !== day) { budget.day = day; budget.count = 0; }
  if (budget.count + calls > limit) {
    alarmBudgetExhausted(`::error::ORS-Tagesbudget erschöpft (${budget.count}/${limit}); Lieferangebote liefern delivery_unverifiable`, now.getTime());
    return false;
  }
  budget.count += calls;
  return true;
}

/** Globales Tagesbudget über DB-Zähler (atomar, RPC ors_take_budget); fehlt die RPC, Rückfall auf das Instanz-Budget. */
async function takeGlobalBudget(supabase: Supa, calls: number): Promise<boolean> {
  const limit = dailyBudget();
  try {
    const { data, error } = await supabase.rpc("ors_take_budget", { p_calls: calls, p_limit: limit });
    if (!error && typeof data === "boolean") {
      if (!data) alarmBudgetExhausted(`::error::ORS-Tagesbudget (global) erschöpft, Limit ${limit}; Lieferangebote liefern delivery_unverifiable`);
      return data;
    }
  } catch { /* RPC fehlt: Rückfall */ }
  return takeOrsBudget(calls);
}

export function resetDistanceCachesForTest() { memCache.clear(); budget.day = ""; budget.count = 0; lastBudgetAlarm = 0; }

export interface DistanceOpts { clientKey?: string; pepper?: string }

/**
 * Einweg-Kilometer mit Cache: Speicher (24 h) -> Tabelle delivery_distance_cache (30 Tage, gehashter Schlüssel, nur mit Pepper)
 * -> OpenRouteService (je Client 10 Fehltreffer/Stunde, globales Tagesbudget). null bei jedem Fehler/Limit (fail closed).
 */
export async function cachedOneWayDistanceKm(supabase: Supa, address: string, apiKey: string | undefined, fetchFn: typeof fetch = fetch, opts: DistanceOpts = {}): Promise<number | null> {
  const key = addressCacheKey(address);
  if (key.length < 5) return null;
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit && now - hit.at < MEM_TTL_MS) return hit.km;
  const remember = (km: number) => {
    memCache.delete(key);
    memCache.set(key, { km, at: Date.now() });
    while (memCache.size > MEM_MAX) { const o = memCache.keys().next().value; if (o === undefined) break; memCache.delete(o); }
  };
  const dbKey = await hashedCacheKey(key, opts.pepper ?? env("DISTANCE_CACHE_PEPPER"));
  if (dbKey) {
    try {
      const { data } = await supabase
        .from("delivery_distance_cache").select("km").eq("address_key", dbKey)
        .gt("created_at", new Date(now - DB_TTL_MS).toISOString()).maybeSingle();
      if (data && data.km !== null && Number.isFinite(Number(data.km))) { const km = Number(data.km); remember(km); return km; }
    } catch { /* Tabelle fehlt/DB-Fehler: ohne Cache weiter */ }
  }
  if (!apiKey) return null;
  // Cache-Fehltreffer kosten ORS-Kontingent: je Client begrenzen, dann global budgetieren
  if (opts.clientKey && rateLimited(`ors-miss:${opts.clientKey}`, ORS_MISSES_PER_CLIENT_HOUR, 3600_000)) return null;
  if (!(await takeGlobalBudget(supabase, 2))) return null;
  const km = await oneWayDistanceKm(address, apiKey, fetchFn);
  if (km === null) return null;
  remember(km);
  if (dbKey) {
    try {
      await supabase.from("delivery_distance_cache").upsert({ address_key: dbKey, km, created_at: new Date().toISOString() }, { onConflict: "address_key" });
      // DSGVO: Einträge älter als 30 Tage opportunistisch beim Schreiben löschen
      await supabase.from("delivery_distance_cache").delete().lt("created_at", new Date(Date.now() - DB_TTL_MS).toISOString());
    } catch { /* nur Cache */ }
  }
  return km;
}

export interface ServerQuoteInput {
  items: QuoteRequestItem[];
  chafingQuantity: number;
  /** 'delivery' | 'pickup' | 'event' (Event-Pakete: weder Lieferung noch Abholung) */
  deliveryType: string;
  address?: { street?: string; zip?: string; city?: string } | null;
  /** Client-Kennung (IP) für die Fehltreffer-Begrenzung der Entfernungsabfrage */
  clientKey?: string;
}

/**
 * Lädt Katalog/Pakete, rechnet die Entfernung per OpenRouteService NEU und baut das Angebot (orderQuote.buildOrderQuote).
 * Wirft bei Datenbankfehlern; Routing-Fehler werden zu `delivery_unverifiable` (fail closed, nie ein geratener Preis).
 */
export async function computeServerQuote(supabase: Supa, input: ServerQuoteInput, apiKey: string | undefined, fetchFn: typeof fetch = fetch): Promise<QuoteOutcome> {
  const items = Array.isArray(input.items) ? input.items : [];
  const ids = items.filter((i) => typeof i?.id === "string").map((i) => i.id);
  const isEvent = ids.some((id) => id.startsWith(EVENT_ID_PREFIX));
  const catalog = isEvent ? {} : await loadCatalog(supabase, ids.filter((id) => id !== CHAFING_DISH_ID));
  const packages = isEvent ? await loadPackages(supabase, ids.filter((id) => id.startsWith(EVENT_ID_PREFIX)).map((id) => id.slice(EVENT_ID_PREFIX.length))) : {};
  const isPickup = input.deliveryType !== "delivery";
  let oneWayKm: number | null = null;
  if (!isEvent && !isPickup) {
    const a = input.address ?? {};
    const street = String(a.street ?? "").trim();
    const zip = String(a.zip ?? "").trim();
    const city = String(a.city ?? "").trim();
    if (!street || !zip || !city) return { ok: false, code: "address_missing", detail: {} };
    oneWayKm = await cachedOneWayDistanceKm(supabase, `${street}, ${zip} ${city}`, apiKey, fetchFn, { clientKey: input.clientKey });
  }
  return buildOrderQuote({ items, chafingQuantity: input.chafingQuantity ?? 0, isPickup }, { catalog, packages, oneWayKm });
}
