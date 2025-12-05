import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MenuType } from "./useMenu";

export interface AdminMenu {
  id: string;
  menu_type: MenuType;
  title: string | null;
  subtitle: string | null;
  is_published: boolean;
  updated_at: string;
  published_at: string | null;
  sort_order: number;
  category_count: number;
  item_count: number;
}

export const useAdminMenus = () => {
  return useQuery({
    queryKey: ['admin-menus'],
    queryFn: async (): Promise<AdminMenu[]> => {
      // Fetch all menus (admin can see all)
      const { data: menus, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .order('sort_order', { ascending: true });

      if (menuError) {
        console.error('Error fetching menus:', menuError);
        return [];
      }

      if (!menus || menus.length === 0) {
        return [];
      }

      // Fetch category counts for each menu
      const menuIds = menus.map(m => m.id);
      const { data: categories, error: catError } = await supabase
        .from('menu_categories')
        .select('id, menu_id')
        .in('menu_id', menuIds);

      if (catError) {
        console.error('Error fetching categories:', catError);
      }

      // Fetch item counts
      const categoryIds = categories?.map(c => c.id) || [];
      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('id, category_id')
        .in('category_id', categoryIds);

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
      }

      // Build the result with counts
      return menus.map(menu => {
        const menuCategories = categories?.filter(c => c.menu_id === menu.id) || [];
        const menuCategoryIds = menuCategories.map(c => c.id);
        const menuItems = items?.filter(i => menuCategoryIds.includes(i.category_id)) || [];

        return {
          id: menu.id,
          menu_type: menu.menu_type as MenuType,
          title: menu.title,
          subtitle: menu.subtitle,
          is_published: menu.is_published || false,
          updated_at: menu.updated_at || menu.created_at || '',
          published_at: menu.published_at,
          sort_order: menu.sort_order || 0,
          category_count: menuCategories.length,
          item_count: menuItems.length,
        };
      });
    },
    staleTime: 30 * 1000, // 30 seconds - shorter for admin
  });
};

export const useAdminMenuByType = (menuType: MenuType) => {
  const { data: menus, ...rest } = useAdminMenus();
  const menu = menus?.find(m => m.menu_type === menuType);
  return { data: menu, ...rest };
};
