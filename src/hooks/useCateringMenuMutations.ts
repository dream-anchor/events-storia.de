import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    }: {
      menuId: string;
      name: string;
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
        sort_order: nextOrder,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
  });
};

// Delete category
export const useDeleteCategory = () => {
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
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
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
      price,
    }: {
      categoryId: string;
      name: string;
      price?: number;
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
        price: price ?? null,
        sort_order: nextOrder,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
  });
};

// Delete menu item
export const useDeleteMenuItem = () => {
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
      queryClient.invalidateQueries({ queryKey: ["catering-menus"] });
    },
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
