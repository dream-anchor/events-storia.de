import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Update menu metadata
export const useUpdateCateringMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      menuId,
      data,
    }: {
      menuId: string;
      data: {
        title?: string | null;
        title_en?: string | null;
        subtitle?: string | null;
        subtitle_en?: string | null;
        additional_info?: string | null;
        additional_info_en?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("menus")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", menuId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["published-catering-menus"] });
    },
  });
};

// Update category
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: {
        name?: string;
        name_en?: string | null;
        description?: string | null;
        description_en?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("menu_categories")
        .update(data)
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["published-catering-menus"] });
    },
  });
};

// Add new category
export const useAddCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      menuId,
      name,
      name_en,
      description,
      description_en,
    }: {
      menuId: string;
      name: string;
      name_en?: string | null;
      description?: string | null;
      description_en?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("menu_categories")
        .select("sort_order")
        .eq("menu_id", menuId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

      const { error } = await supabase.from("menu_categories").insert({
        menu_id: menuId,
        name,
        name_en: name_en || null,
        description: description || null,
        description_en: description_en || null,
        sort_order: nextOrder,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
  });
};

// Soft-Delete category (+ Items)
export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const now = new Date().toISOString();
      // Soft-delete all items in this category
      await supabase
        .from("menu_items")
        .update({ deleted_at: now } as Record<string, unknown>)
        .eq("category_id", categoryId)
        .is("deleted_at", null);
      // Soft-delete the category
      const { error } = await supabase
        .from("menu_categories")
        .update({ deleted_at: now } as Record<string, unknown>)
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["menu-trash"] });
    },
  });
};

// Restore category from trash
export const useRestoreCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      // Restore category
      const { error } = await supabase
        .from("menu_categories")
        .update({ deleted_at: null } as Record<string, unknown>)
        .eq("id", categoryId);

      if (error) throw error;

      // Restore its items too
      await supabase
        .from("menu_items")
        .update({ deleted_at: null } as Record<string, unknown>)
        .eq("category_id", categoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["menu-trash"] });
    },
  });
};

// Update menu item
export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: {
        name?: string;
        name_en?: string | null;
        description?: string | null;
        description_en?: string | null;
        price?: number | null;
        price_display?: string | null;
        image_url?: string | null;
        serving_info?: string | null;
        serving_info_en?: string | null;
        min_order?: string | null;
        min_order_en?: string | null;
        is_vegetarian?: boolean;
        is_vegan?: boolean;
        allergens?: string | null;
        category_id?: string;
      };
    }) => {
      const { error } = await supabase
        .from("menu_items")
        .update(data)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["published-catering-menus"] });
    },
  });
};

// Add new menu item
export const useAddMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      categoryId,
      name,
      name_en,
      description,
      description_en,
      price,
      price_display,
      serving_info,
      serving_info_en,
      min_order,
      min_order_en,
      is_vegetarian,
      is_vegan,
      image_url,
    }: {
      categoryId: string;
      name: string;
      name_en?: string | null;
      description?: string | null;
      description_en?: string | null;
      price?: number | null;
      price_display?: string | null;
      serving_info?: string | null;
      serving_info_en?: string | null;
      min_order?: string | null;
      min_order_en?: string | null;
      is_vegetarian?: boolean;
      is_vegan?: boolean;
      image_url?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("menu_items")
        .select("sort_order")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

      const { error } = await supabase.from("menu_items").insert({
        category_id: categoryId,
        name,
        name_en: name_en || null,
        description: description || null,
        description_en: description_en || null,
        price: price ?? null,
        price_display: price_display || null,
        serving_info: serving_info || null,
        serving_info_en: serving_info_en || null,
        min_order: min_order || null,
        min_order_en: min_order_en || null,
        is_vegetarian: is_vegetarian ?? false,
        is_vegan: is_vegan ?? false,
        image_url: image_url || null,
        sort_order: nextOrder,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
  });
};

// Soft-Delete menu item
export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["menu-trash"] });
    },
  });
};

// Restore menu item from trash
export const useRestoreMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ deleted_at: null } as Record<string, unknown>)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
      queryClient.invalidateQueries({ queryKey: ["menu-trash"] });
    },
  });
};

// Permanent delete menu item
export const usePermanentDeleteMenuItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-trash"] });
    },
  });
};

// Permanent delete category
export const usePermanentDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      // Delete items first
      await supabase.from("menu_items").delete().eq("category_id", categoryId);
      // Delete category
      const { error } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-trash"] });
    },
  });
};

// Trash items query
export interface TrashItem {
  id: string;
  type: 'item' | 'category';
  name: string;
  categoryName?: string;
  deletedAt: string;
  daysRemaining: number;
}

export const useMenuTrash = () => {
  return useQuery({
    queryKey: ["menu-trash"],
    queryFn: async (): Promise<TrashItem[]> => {
      const now = Date.now();
      const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
      const trash: TrashItem[] = [];

      // Fetch deleted categories
      const { data: categories } = await supabase
        .from("menu_categories")
        .select("id, name, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      for (const cat of categories || []) {
        const deletedTime = new Date(cat.deleted_at).getTime();
        const remaining = Math.max(0, Math.ceil((deletedTime + SIXTY_DAYS_MS - now) / (24 * 60 * 60 * 1000)));
        trash.push({
          id: cat.id,
          type: 'category',
          name: cat.name,
          deletedAt: cat.deleted_at,
          daysRemaining: remaining,
        });
      }

      // Fetch deleted items (not in deleted categories — those show under their category)
      const deletedCategoryIds = (categories || []).map(c => c.id);
      let itemsQuery = supabase
        .from("menu_items")
        .select("id, name, deleted_at, category_id, menu_categories!inner(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (deletedCategoryIds.length > 0) {
        // Exclude items that belong to deleted categories (they'll restore with the category)
        for (const catId of deletedCategoryIds) {
          itemsQuery = itemsQuery.neq("category_id", catId);
        }
      }

      const { data: items } = await itemsQuery;

      for (const item of items || []) {
        const deletedTime = new Date(item.deleted_at).getTime();
        const remaining = Math.max(0, Math.ceil((deletedTime + SIXTY_DAYS_MS - now) / (24 * 60 * 60 * 1000)));
        const catData = item.menu_categories as unknown as { name: string } | null;
        trash.push({
          id: item.id,
          type: 'item',
          name: item.name,
          categoryName: catData?.name || undefined,
          deletedAt: item.deleted_at,
          daysRemaining: remaining,
        });
      }

      // Auto-purge: delete items older than 60 days client-side as fallback
      const expiredItems = trash.filter(t => t.daysRemaining <= 0);
      if (expiredItems.length > 0) {
        for (const expired of expiredItems) {
          if (expired.type === 'item') {
            await supabase.from("menu_items").delete().eq("id", expired.id);
          } else {
            await supabase.from("menu_items").delete().eq("category_id", expired.id);
            await supabase.from("menu_categories").delete().eq("id", expired.id);
          }
        }
      }

      return trash.filter(t => t.daysRemaining > 0);
    },
    staleTime: 30000,
  });
};

// Upload image to storage
export const uploadCateringImage = async (file: File): Promise<string> => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `menu-items/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("catering-images")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("catering-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
};
