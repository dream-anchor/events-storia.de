import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from '../_shared/cors.ts';

interface RawItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_display: string | null;
  category_id: string;
  sort_order: number;
}

interface RawCategory {
  id: string;
  name: string;
  menu_id: string;
  sort_order: number;
}

interface RawMenu {
  id: string;
  menu_type: string;
}

interface ImportItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  priceDisplay: string | null;
}

interface TastingMenu extends ImportItem {
  winePairing: ImportItem | null;
}

interface CourseCategory {
  categoryName: string;
  items: ImportItem[];
}

function formatPrice(price: number | null, priceDisplay: string | null): string | null {
  if (priceDisplay) return priceDisplay;
  if (price == null) return null;
  return `${price.toFixed(2)} €`;
}

function toImportItem(raw: RawItem): ImportItem {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    price: raw.price,
    priceDisplay: formatPrice(raw.price, raw.price_display),
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ristoranteUrl = Deno.env.get('RISTORANTE_SUPABASE_URL');
    const ristoranteAnonKey = Deno.env.get('RISTORANTE_SUPABASE_ANON_KEY');

    if (!ristoranteUrl || !ristoranteAnonKey) {
      throw new Error('External database credentials not configured');
    }

    const client = createClient(ristoranteUrl, ristoranteAnonKey);

    // Fetch lunch + food menus
    const { data: menus, error: menusError } = await client
      .from('menus')
      .select('id, menu_type')
      .eq('is_published', true)
      .in('menu_type', ['lunch', 'food'])
      .order('sort_order', { ascending: true });

    if (menusError) throw new Error(`Failed to fetch menus: ${menusError.message}`);
    if (!menus || menus.length === 0) {
      return new Response(
        JSON.stringify({ lunch: null, dinner: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const menuIds = menus.map((m: RawMenu) => m.id);

    // Fetch categories
    const { data: categories, error: catError } = await client
      .from('menu_categories')
      .select('id, name, menu_id, sort_order')
      .in('menu_id', menuIds)
      .order('sort_order', { ascending: true });

    if (catError) throw new Error(`Failed to fetch categories: ${catError.message}`);

    const categoryIds = (categories || []).map((c: RawCategory) => c.id);

    // Fetch items
    const { data: items, error: itemsError } = await client
      .from('menu_items')
      .select('id, name, description, price, price_display, category_id, sort_order')
      .in('category_id', categoryIds)
      .order('sort_order', { ascending: true });

    if (itemsError) throw new Error(`Failed to fetch items: ${itemsError.message}`);

    const allItems: RawItem[] = items || [];
    const allCategories: RawCategory[] = categories || [];

    // Helpers
    const categoriesByMenu = (menuId: string) =>
      allCategories.filter((c) => c.menu_id === menuId);

    const itemsByCategory = (catId: string) =>
      allItems.filter((i) => i.category_id === catId);

    // === LUNCH ===
    const lunchMenu = menus.find((m: RawMenu) => m.menu_type === 'lunch');
    let lunchResult = null;

    if (lunchMenu) {
      const lunchCats = categoriesByMenu(lunchMenu.id);

      // sort_order 0 = "3-Gänge-Menü" Kategorie → package items
      const packageCat = lunchCats.find((c) => c.sort_order === 0);
      const packageItems: ImportItem[] = packageCat
        ? itemsByCategory(packageCat.id).map(toImportItem)
        : [];

      // sort_order 1-8 → courses
      const courses: CourseCategory[] = lunchCats
        .filter((c) => c.sort_order > 0)
        .map((c) => ({
          categoryName: c.name,
          items: itemsByCategory(c.id).map(toImportItem),
        }));

      lunchResult = { packageItems, courses };
    }

    // === DINNER (food) ===
    const dinnerMenu = menus.find((m: RawMenu) => m.menu_type === 'food');
    let dinnerResult = null;

    if (dinnerMenu) {
      const dinnerCats = categoriesByMenu(dinnerMenu.id);

      // sort_order 1 = "Degustationsmenüs" → tasting menus
      const tastingCat = dinnerCats.find((c) => c.sort_order === 1);
      const tastingMenus: TastingMenu[] = [];

      if (tastingCat) {
        const tastingItems = itemsByCategory(tastingCat.id);

        for (let i = 0; i < tastingItems.length; i++) {
          const item = tastingItems[i];
          if (item.name.toLowerCase().includes('weinbegleitung')) continue;

          const nextItem = tastingItems[i + 1];
          const winePairing =
            nextItem && nextItem.name.toLowerCase().includes('weinbegleitung')
              ? toImportItem(nextItem)
              : null;

          tastingMenus.push({ ...toImportItem(item), winePairing });
        }
      }

      // sort_order 2+ → à-la-carte
      const alaCarte: CourseCategory[] = dinnerCats
        .filter((c) => c.sort_order >= 2)
        .map((c) => ({
          categoryName: c.name,
          items: itemsByCategory(c.id).map(toImportItem),
        }));

      dinnerResult = { tastingMenus, alaCarte };
    }

    return new Response(
      JSON.stringify({ lunch: lunchResult, dinner: dinnerResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-ristorante-complete-menus:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
