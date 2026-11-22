// Catering-Preisprüfung: I/O-Teile (Katalog laden, Entfernung per OpenRouteService).
// Reine Rechenlogik: cateringPricing.ts.
import type { Catalog } from "./cateringPricing.ts";

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
    .in("id", wanted);
  if (error) throw new Error(`catalog_load_failed: ${error.message}`);
  const catIds = [...new Set((items ?? []).map((i: { category_id: string }) => i.category_id).filter(Boolean))];
  const menuByCat = new Map<string, string>(); // nur aktive Kategorien (wie useCateringMenus: deleted_at/archived_at IS NULL)
  const slugByMenu = new Map<string, string | null>(); // nur veröffentlichte Catering-Menüs
  if (catIds.length > 0) {
    const { data: cats, error: cErr } = await supabase
      .from("menu_categories").select("id, menu_id").in("id", catIds).is("deleted_at", null).is("archived_at", null);
    if (cErr) throw new Error(`catalog_load_failed: ${cErr.message}`);
    const menuIds = [...new Set((cats ?? []).map((c: { menu_id: string }) => c.menu_id))];
    if (menuIds.length > 0) {
      const { data: menus, error: mErr } = await supabase
        .from("menus").select("id, slug").in("id", menuIds).eq("menu_type", "catering").eq("is_published", true);
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

/** Einweg-Straßenkilometer ab Karlstr. 47a (Geocoding + Directions wie calculate-delivery). null bei jedem Fehler. */
export async function oneWayDistanceKm(address: string, apiKey: string | undefined, fetchFn: typeof fetch = fetch): Promise<number | null> {
  if (!apiKey || address.trim().length < 5) return null;
  try {
    const g = await fetchFn(`https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&boundary.country=DE`);
    if (!g.ok) return null;
    const gj = await g.json();
    const coords = gj.features?.[0]?.geometry?.coordinates;
    if (!coords) return null;
    const [lng, lat] = coords;
    const d = await fetchFn("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[RESTAURANT_COORDS.lng, RESTAURANT_COORDS.lat], [lng, lat]] }),
    });
    if (!d.ok) return null;
    const meters = (await d.json()).routes?.[0]?.summary?.distance;
    return typeof meters === "number" && meters > 0 ? meters / 1000 : null;
  } catch {
    return null;
  }
}
