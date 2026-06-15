// Catalog snippet builder for the AI catering assistant draft.
//
// Returns a small, sanitized snapshot of `packages` and `menu_items` that
// can be safely shown to the model as price source. Only active, visible,
// non-archived, non-deleted entries with a machine-readable price are
// included. `price_display` is marketing text and is NEVER returned here.
//
// This module is wiring infrastructure for Step 1 of the AI-Draft build —
// it is not yet injected into the model prompt.

export interface CatalogPackage {
  id: string;
  name: string;
  name_en: string | null;
  package_type: string | null;
  price: number | null;
  price_per_person: boolean;
  pricing_type: string | null;
  pricing_tiers: unknown;
  min_guests: number | null;
  max_guests: number | null;
  currency: string;
  duration_minutes: number | null;
  description: string | null;
  description_en: string | null;
}

export interface CatalogItem {
  id: string;
  category_id: string | null;
  name: string;
  name_en: string | null;
  price: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
  allergens: string | null;
  min_order: string | null;
  serving_info: string | null;
}

export interface CatalogSnippet {
  packages: CatalogPackage[];
  items: CatalogItem[];
}

const PACKAGE_LIMIT = 12;
const ITEM_LIMIT = 30;

export async function loadCatalogSnippet(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  opts: { packageLimit?: number; itemLimit?: number } = {},
): Promise<CatalogSnippet> {
  const packageLimit = opts.packageLimit ?? PACKAGE_LIMIT;
  const itemLimit = opts.itemLimit ?? ITEM_LIMIT;

  const [{ data: pkgRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from("packages")
      .select(
        "id, name, name_en, package_type, price, price_per_person, pricing_type, pricing_tiers, min_guests, max_guests, currency, duration_minutes, description, description_en, is_active, visible_on_website, sort_order",
      )
      .eq("is_active", true)
      .eq("visible_on_website", true)
      .order("sort_order", { ascending: true })
      .limit(packageLimit),
    supabase
      .from("menu_items")
      .select(
        "id, category_id, name, name_en, price, is_vegetarian, is_vegan, allergens, min_order, serving_info, deleted_at, archived_at, sort_order",
      )
      .is("deleted_at", null)
      .is("archived_at", null)
      .not("price", "is", null)
      .order("sort_order", { ascending: true })
      .limit(itemLimit),
  ]);

  const packages: CatalogPackage[] = (pkgRows ?? [])
    .filter((p: Record<string, unknown>) => p.price != null || (p.pricing_type === "tiered"))
    .map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      name_en: (p.name_en as string | null) ?? null,
      package_type: (p.package_type as string | null) ?? null,
      price: p.price == null ? null : Number(p.price),
      price_per_person: Boolean(p.price_per_person),
      pricing_type: (p.pricing_type as string | null) ?? null,
      pricing_tiers: p.pricing_tiers ?? null,
      min_guests: p.min_guests == null ? null : Number(p.min_guests),
      max_guests: p.max_guests == null ? null : Number(p.max_guests),
      currency: String(p.currency ?? "EUR"),
      duration_minutes:
        p.duration_minutes == null ? null : Number(p.duration_minutes),
      description: (p.description as string | null) ?? null,
      description_en: (p.description_en as string | null) ?? null,
    }));

  const items: CatalogItem[] = (itemRows ?? [])
    .filter((i: Record<string, unknown>) => i.price != null && Number.isFinite(Number(i.price)))
    .map((i: Record<string, unknown>) => ({
      id: String(i.id),
      category_id: (i.category_id as string | null) ?? null,
      name: String(i.name ?? ""),
      name_en: (i.name_en as string | null) ?? null,
      price: Number(i.price),
      is_vegetarian: Boolean(i.is_vegetarian),
      is_vegan: Boolean(i.is_vegan),
      allergens: (i.allergens as string | null) ?? null,
      min_order: (i.min_order as string | null) ?? null,
      serving_info: (i.serving_info as string | null) ?? null,
    }));

  return { packages, items };
}
