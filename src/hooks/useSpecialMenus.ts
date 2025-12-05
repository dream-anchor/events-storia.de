import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify, generateUniqueSlug } from "@/lib/slugify";

export interface ParsedMenuItem {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number | null;
  price_display: string;
  sort_order: number;
}

export interface ParsedMenuCategory {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  sort_order: number;
  items: ParsedMenuItem[];
}

export interface ParsedMenu {
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  categories: ParsedMenuCategory[];
}

export interface SpecialMenu {
  id: string;
  title: string | null;
  title_en: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  slug: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  sort_order: number;
  category_count: number;
  item_count: number;
}

export const useSpecialMenus = () => {
  return useQuery({
    queryKey: ['special-menus'],
    queryFn: async (): Promise<SpecialMenu[]> => {
      const { data: menus, error } = await supabase
        .from('menus')
        .select('*')
        .eq('menu_type', 'special')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      if (!menus || menus.length === 0) return [];

      // Get categories and items counts for each menu
      const menuIds = menus.map(m => m.id);
      
      const { data: categories } = await supabase
        .from('menu_categories')
        .select('id, menu_id')
        .in('menu_id', menuIds);

      const categoryIds = categories?.map(c => c.id) || [];
      
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, category_id')
        .in('category_id', categoryIds);

      return menus.map(menu => {
        const menuCategories = categories?.filter(c => c.menu_id === menu.id) || [];
        const menuCategoryIds = menuCategories.map(c => c.id);
        const menuItems = items?.filter(i => menuCategoryIds.includes(i.category_id)) || [];

        return {
          id: menu.id,
          title: menu.title,
          title_en: menu.title_en,
          subtitle: menu.subtitle,
          subtitle_en: menu.subtitle_en,
          slug: (menu as any).slug || null,
          is_published: menu.is_published || false,
          published_at: menu.published_at,
          created_at: menu.created_at,
          updated_at: menu.updated_at,
          sort_order: menu.sort_order || 0,
          category_count: menuCategories.length,
          item_count: menuItems.length,
        };
      });
    },
    staleTime: 30 * 1000,
  });
};

export const usePublishedSpecialMenus = () => {
  return useQuery({
    queryKey: ['published-special-menus'],
    queryFn: async () => {
      const { data: menus, error } = await supabase
        .from('menus')
        .select('*')
        .eq('menu_type', 'special')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return menus || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateSpecialMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get the highest sort_order of existing special menus
      const { data: existingMenus } = await supabase
        .from('menus')
        .select('sort_order')
        .eq('menu_type', 'special')
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = existingMenus && existingMenus.length > 0 
        ? (existingMenus[0].sort_order || 99) + 1 
        : 100;

      // Generate unique slug
      const baseSlug = slugify('Neuer Anlass');
      const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug) => {
        const { data } = await supabase
          .from('menus')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        return !!data;
      });

      const { data, error } = await supabase
        .from('menus')
        .insert({
          menu_type: 'special',
          title: 'Neuer Anlass',
          slug: uniqueSlug,
          is_published: false,
          sort_order: nextSortOrder,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-menus'] });
    },
  });
};

export const useDeleteSpecialMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (menuId: string) => {
      // First get all categories for this menu
      const { data: categories } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('menu_id', menuId);

      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        
        // Delete all items in these categories
        await supabase
          .from('menu_items')
          .delete()
          .in('category_id', categoryIds);

        // Delete all categories
        await supabase
          .from('menu_categories')
          .delete()
          .eq('menu_id', menuId);
      }

      // Delete the menu
      const { error } = await supabase
        .from('menus')
        .delete()
        .eq('id', menuId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-menus'] });
    },
  });
};

export const useMenuContent = (menuId: string | undefined) => {
  return useQuery({
    queryKey: ['menu-content', menuId],
    queryFn: async (): Promise<ParsedMenu | null> => {
      if (!menuId) return null;
      
      // Load menu data
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('id', menuId)
        .maybeSingle();
      
      if (menuError) throw menuError;
      if (!menu) return null;

      // Load categories
      const { data: categories, error: catError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('menu_id', menuId)
        .order('sort_order');
      
      if (catError) throw catError;

      // Load items for all categories
      const categoryIds = categories?.map(c => c.id) || [];
      let items: any[] = [];
      
      if (categoryIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('menu_items')
          .select('*')
          .in('category_id', categoryIds)
          .order('sort_order');
        
        if (itemsError) throw itemsError;
        items = itemsData || [];
      }

      // Convert to ParsedMenu format
      return {
        title: menu.title || '',
        title_en: menu.title_en || '',
        subtitle: menu.subtitle || '',
        subtitle_en: menu.subtitle_en || '',
        categories: categories?.map(cat => ({
          name: cat.name,
          name_en: cat.name_en || '',
          description: cat.description || '',
          description_en: cat.description_en || '',
          sort_order: cat.sort_order || 0,
          items: items
            .filter(item => item.category_id === cat.id)
            .map(item => ({
              name: item.name,
              name_en: item.name_en || '',
              description: item.description || '',
              description_en: item.description_en || '',
              price: item.price,
              price_display: item.price_display || '',
              sort_order: item.sort_order || 0,
            })),
        })) || [],
      };
    },
    enabled: !!menuId,
    staleTime: 0,
  });
};

export const useSaveMenuContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, data }: { menuId: string; data: ParsedMenu }) => {
      // Generate new slug from title
      const baseSlug = slugify(data.title);
      const uniqueSlug = await generateUniqueSlug(baseSlug, async (slug) => {
        const { data: existing } = await supabase
          .from('menus')
          .select('id')
          .eq('slug', slug)
          .neq('id', menuId)
          .maybeSingle();
        return !!existing;
      });

      // Update menu title/subtitle/slug
      const { error: menuError } = await supabase
        .from('menus')
        .update({
          title: data.title,
          title_en: data.title_en,
          subtitle: data.subtitle,
          subtitle_en: data.subtitle_en,
          slug: uniqueSlug,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', menuId);

      if (menuError) throw menuError;

      // Get existing categories to delete them
      const { data: existingCategories } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('menu_id', menuId);

      if (existingCategories && existingCategories.length > 0) {
        const categoryIds = existingCategories.map(c => c.id);
        
        // Delete existing items
        await supabase
          .from('menu_items')
          .delete()
          .in('category_id', categoryIds);

        // Delete existing categories
        await supabase
          .from('menu_categories')
          .delete()
          .eq('menu_id', menuId);
      }

      // Insert new categories and items
      for (let catIndex = 0; catIndex < data.categories.length; catIndex++) {
        const category = data.categories[catIndex];
        
        const { data: newCategory, error: catError } = await supabase
          .from('menu_categories')
          .insert({
            menu_id: menuId,
            name: category.name,
            name_en: category.name_en || null,
            description: category.description || null,
            description_en: category.description_en || null,
            sort_order: catIndex,
          })
          .select()
          .single();

        if (catError) throw catError;

        // Insert items for this category
        if (category.items.length > 0) {
          const itemsToInsert = category.items.map((item, itemIndex) => ({
            category_id: newCategory.id,
            name: item.name,
            name_en: item.name_en || null,
            description: item.description || null,
            description_en: item.description_en || null,
            price: item.price,
            price_display: item.price_display || null,
            sort_order: itemIndex,
          }));

          const { error: itemsError } = await supabase
            .from('menu_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-menus'] });
      queryClient.invalidateQueries({ queryKey: ['menu-content'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menus'] });
      queryClient.invalidateQueries({ queryKey: ['published-special-menus'] });
      queryClient.invalidateQueries({ queryKey: ['special-menu'] });
    },
  });
};

export const useSpecialMenuBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['special-menu', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
};
