import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CateringMenuItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  price_display: string | null;
  image_url: string | null;
  serving_info: string | null;
  serving_info_en: string | null;
  min_order: string | null;
  min_order_en: string | null;
  sort_order: number;
  is_vegetarian: boolean;
  is_vegan: boolean;
}

export interface CateringCategory {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  sort_order: number;
  items: CateringMenuItem[];
}

export interface CateringMenu {
  id: string;
  title: string | null;
  title_en: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  slug: string | null;
  is_published: boolean;
  additional_info: string | null;
  additional_info_en: string | null;
  created_at: string;
  updated_at: string;
  categories: CateringCategory[];
}

// Fetch all catering menus (for admin)
export const useCateringMenus = () => {
  return useQuery({
    queryKey: ["catering-menus"],
    queryFn: async (): Promise<CateringMenu[]> => {
      const { data: menus, error } = await supabase
        .from("menus")
        .select("*")
        .eq("menu_type", "catering")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (!menus) return [];

      // Fetch categories and items for each menu
      const menusWithContent = await Promise.all(
        menus.map(async (menu) => {
          const { data: categories } = await supabase
            .from("menu_categories")
            .select("*")
            .eq("menu_id", menu.id)
            .order("sort_order", { ascending: true });

          const categoriesWithItems = await Promise.all(
            (categories || []).map(async (category) => {
              const { data: items } = await supabase
                .from("menu_items")
                .select("*")
                .eq("category_id", category.id)
                .order("sort_order", { ascending: true });

              return {
                ...category,
                items: items || [],
              };
            })
          );

          return {
            ...menu,
            categories: categoriesWithItems,
          };
        })
      );

      return menusWithContent as CateringMenu[];
    },
  });
};

// Fetch published catering menus (for frontend)
export const usePublishedCateringMenus = () => {
  return useQuery({
    queryKey: ["published-catering-menus"],
    queryFn: async (): Promise<CateringMenu[]> => {
      const { data: menus, error } = await supabase
        .from("menus")
        .select("*")
        .eq("menu_type", "catering")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (!menus) return [];

      const menusWithContent = await Promise.all(
        menus.map(async (menu) => {
          const { data: categories } = await supabase
            .from("menu_categories")
            .select("*")
            .eq("menu_id", menu.id)
            .order("sort_order", { ascending: true });

          const categoriesWithItems = await Promise.all(
            (categories || []).map(async (category) => {
              const { data: items } = await supabase
                .from("menu_items")
                .select("*")
                .eq("category_id", category.id)
                .order("sort_order", { ascending: true });

              return {
                ...category,
                items: items || [],
              };
            })
          );

          return {
            ...menu,
            categories: categoriesWithItems,
          };
        })
      );

      return menusWithContent as CateringMenu[];
    },
  });
};

// Fetch single catering menu by slug
export const useCateringMenuBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["catering-menu", slug],
    queryFn: async (): Promise<CateringMenu | null> => {
      if (!slug) return null;

      const { data: menu, error } = await supabase
        .from("menus")
        .select("*")
        .eq("menu_type", "catering")
        .eq("slug", slug)
        .eq("is_published", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      if (!menu) return null;

      const { data: categories } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("menu_id", menu.id)
        .order("sort_order", { ascending: true });

      const categoriesWithItems = await Promise.all(
        (categories || []).map(async (category) => {
          const { data: items } = await supabase
            .from("menu_items")
            .select("*")
            .eq("category_id", category.id)
            .order("sort_order", { ascending: true });

          return {
            ...category,
            items: items || [],
          };
        })
      );

      return {
        ...menu,
        categories: categoriesWithItems,
      } as CateringMenu;
    },
    enabled: !!slug,
  });
};

// Create a new catering menu
export const useCreateCateringMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; slug: string }) => {
      const { data: menu, error } = await supabase
        .from("menus")
        .insert({
          menu_type: "catering",
          title: data.title,
          slug: data.slug,
          is_published: false,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return menu;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
  });
};

// Delete a catering menu
export const useDeleteCateringMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (menuId: string) => {
      // Delete items first
      const { data: categories } = await supabase
        .from("menu_categories")
        .select("id")
        .eq("menu_id", menuId);

      if (categories) {
        for (const category of categories) {
          await supabase
            .from("menu_items")
            .delete()
            .eq("category_id", category.id);
        }
      }

      // Delete categories
      await supabase.from("menu_categories").delete().eq("menu_id", menuId);

      // Delete menu
      const { error } = await supabase.from("menus").delete().eq("id", menuId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
  });
};

// Toggle publish status
export const useToggleCateringMenuPublish = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      menuId,
      isPublished,
    }: {
      menuId: string;
      isPublished: boolean;
    }) => {
      const { error } = await supabase
        .from("menus")
        .update({
          is_published: isPublished,
          published_at: isPublished ? new Date().toISOString() : null,
        })
        .eq("id", menuId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["published-catering-menus"] });
    },
  });
};
