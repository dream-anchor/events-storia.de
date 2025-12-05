import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MenuType = 'lunch' | 'food' | 'drinks' | 'christmas' | 'valentines' | 'special';

export interface MenuItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  price_display: string | null;
  sort_order: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  sort_order: number;
  items: MenuItem[];
}

export interface Menu {
  id: string;
  menu_type: MenuType;
  title: string | null;
  subtitle: string | null;
  is_published: boolean;
  categories: MenuCategory[];
}

// Shared function to fetch menu data by ID
const fetchMenuById = async (menuId: string): Promise<Menu | null> => {
  const { data: menu, error: menuError } = await supabase
    .from('menus')
    .select('*')
    .eq('id', menuId)
    .single();

  if (menuError || !menu) {
    console.log(`No menu found for id: ${menuId}`);
    return null;
  }

  return fetchMenuData(menu);
};

// Shared function to process menu data
const fetchMenuData = async (menu: any): Promise<Menu | null> => {
  // Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('menu_id', menu.id)
    .order('sort_order');

  if (catError) {
    console.error('Error fetching categories:', catError);
    return null;
  }

  // Fetch items for all categories
  const categoryIds = categories?.map(c => c.id) || [];
  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select('*')
    .in('category_id', categoryIds)
    .order('sort_order');

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
    return null;
  }

  // Organize items by category
  const categoriesWithItems: MenuCategory[] = (categories || []).map(cat => ({
    id: cat.id,
    name: cat.name,
    name_en: cat.name_en,
    description: cat.description,
    description_en: cat.description_en,
    sort_order: cat.sort_order || 0,
    items: (items || [])
      .filter(item => item.category_id === cat.id)
      .map(item => ({
        id: item.id,
        name: item.name,
        name_en: item.name_en,
        description: item.description,
        description_en: item.description_en,
        price: item.price ? parseFloat(item.price.toString()) : null,
        price_display: item.price_display,
        sort_order: item.sort_order || 0,
      }))
  }));

  return {
    id: menu.id,
    menu_type: menu.menu_type as MenuType,
    title: menu.title,
    subtitle: menu.subtitle,
    is_published: menu.is_published || false,
    categories: categoriesWithItems,
  };
};

export const useMenu = (menuType: MenuType) => {
  return useQuery({
    queryKey: ['menu', menuType],
    queryFn: async (): Promise<Menu | null> => {
      // Fetch menu by type
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('menu_type', menuType)
        .eq('is_published', true)
        .maybeSingle();

      if (menuError || !menu) {
        console.log(`No published menu found for type: ${menuType}`);
        return null;
      }

      return fetchMenuData(menu);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useMenuById = (menuId: string | undefined) => {
  return useQuery({
    queryKey: ['menu-by-id', menuId],
    queryFn: async (): Promise<Menu | null> => {
      if (!menuId) return null;
      return fetchMenuById(menuId);
    },
    enabled: !!menuId,
    staleTime: 5 * 60 * 1000,
  });
};
