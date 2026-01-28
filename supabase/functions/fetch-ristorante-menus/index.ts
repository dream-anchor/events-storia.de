import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MenuItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  price_display: string | null;
  serving_info: string | null;
  serving_info_en: string | null;
  is_vegetarian: boolean;
  is_vegan: boolean;
  allergens: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  category_name_en: string | null;
  menu_type: string;
  menu_title: string | null;
  menu_title_en: string | null;
}

interface MenuCategory {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  menu_id: string;
  menu_type: string;
  menu_title: string | null;
  menu_title_en: string | null;
  items: MenuItem[];
}

interface Menu {
  id: string;
  menu_type: string;
  title: string | null;
  title_en: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  categories: MenuCategory[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get external Supabase credentials
    const ristoranteUrl = Deno.env.get('RISTORANTE_SUPABASE_URL');
    const ristoranteAnonKey = Deno.env.get('RISTORANTE_SUPABASE_ANON_KEY');

    if (!ristoranteUrl || !ristoranteAnonKey) {
      console.error('Missing Ristorante Supabase credentials');
      throw new Error('External database credentials not configured');
    }

    console.log('Connecting to Ristorante database...');
    
    // Create client for external Ristorante database
    const ristoranteClient = createClient(ristoranteUrl, ristoranteAnonKey);

    // Parse request body for optional filters
    let menuTypes: string[] | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        menuTypes = body.menuTypes || null;
      } catch {
        // No body or invalid JSON - fetch all menus
      }
    }

    // Fetch published menus
    let menusQuery = ristoranteClient
      .from('menus')
      .select('id, menu_type, title, title_en, subtitle, subtitle_en')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (menuTypes && menuTypes.length > 0) {
      menusQuery = menusQuery.in('menu_type', menuTypes);
    }

    const { data: menus, error: menusError } = await menusQuery;

    if (menusError) {
      console.error('Error fetching menus:', menusError);
      throw new Error(`Failed to fetch menus: ${menusError.message}`);
    }

    console.log(`Fetched ${menus?.length || 0} menus`);

    if (!menus || menus.length === 0) {
      return new Response(
        JSON.stringify({ menus: [], items: [], categories: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const menuIds = menus.map(m => m.id);

    // Fetch categories for these menus
    const { data: categories, error: categoriesError } = await ristoranteClient
      .from('menu_categories')
      .select('id, name, name_en, description, description_en, menu_id, sort_order')
      .in('menu_id', menuIds)
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw new Error(`Failed to fetch categories: ${categoriesError.message}`);
    }

    console.log(`Fetched ${categories?.length || 0} categories`);

    const categoryIds = categories?.map(c => c.id) || [];

    // Fetch all menu items - use * to get all available columns
    const { data: items, error: itemsError } = await ristoranteClient
      .from('menu_items')
      .select('*')
      .in('category_id', categoryIds)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    console.log(`Fetched ${items?.length || 0} menu items`);

    // Build enriched response with category and menu info
    const enrichedItems: MenuItem[] = (items || []).map(item => {
      const category = categories?.find(c => c.id === item.category_id);
      const menu = menus.find(m => m.id === category?.menu_id);
      
      return {
        ...item,
        category_name: category?.name || 'Unbekannt',
        category_name_en: category?.name_en || null,
        menu_type: menu?.menu_type || 'unknown',
        menu_title: menu?.title || null,
        menu_title_en: menu?.title_en || null,
      };
    });

    // Build structured response
    const structuredMenus: Menu[] = menus.map(menu => ({
      ...menu,
      categories: (categories || [])
        .filter(c => c.menu_id === menu.id)
        .map(cat => ({
          ...cat,
          menu_type: menu.menu_type,
          menu_title: menu.title,
          menu_title_en: menu.title_en,
          items: enrichedItems.filter(i => i.category_id === cat.id),
        })),
    }));

    const response = {
      menus: structuredMenus,
      items: enrichedItems,
      categories: (categories || []).map(cat => {
        const menu = menus.find(m => m.id === cat.menu_id);
        return {
          ...cat,
          menu_type: menu?.menu_type || 'unknown',
          menu_title: menu?.title || null,
          menu_title_en: menu?.title_en || null,
        };
      }),
      totalItems: enrichedItems.length,
      totalCategories: categories?.length || 0,
      totalMenus: menus.length,
    };

    console.log('Successfully built response with', response.totalItems, 'items');

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-ristorante-menus:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        menus: [],
        items: [],
        categories: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
