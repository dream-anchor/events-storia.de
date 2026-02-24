import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RistoranteMenuItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  price_display: string | null;
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
  // Optional fields that may not exist in the other database
  serving_info?: string | null;
  serving_info_en?: string | null;
  sort_order?: number;
}

export interface RistoranteCategory {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  menu_id: string;
  menu_type: string;
  menu_title: string | null;
  menu_title_en: string | null;
  items?: RistoranteMenuItem[];
}

export interface RistoranteMenu {
  id: string;
  menu_type: string;
  title: string | null;
  title_en: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  categories: RistoranteCategory[];
}

export interface RistoranteMenusResponse {
  menus: RistoranteMenu[];
  items: RistoranteMenuItem[];
  categories: RistoranteCategory[];
  totalItems: number;
  totalCategories: number;
  totalMenus: number;
  error?: string;
}

interface UseRistoranteMenusOptions {
  menuTypes?: string[];
  enabled?: boolean;
}

export const useRistoranteMenus = (options: UseRistoranteMenusOptions = {}) => {
  const { menuTypes, enabled = true } = options;

  return useQuery({
    queryKey: ['ristorante-menus', menuTypes],
    queryFn: async (): Promise<RistoranteMenusResponse> => {
      const { data, error } = await supabase.functions.invoke('fetch-ristorante-menus', {
        body: menuTypes ? { menuTypes } : undefined,
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch restaurant menus');
      }

      return data as RistoranteMenusResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Convenience hooks for specific menu types
export const useRistoranteFoodMenu = (enabled = true) => {
  return useRistoranteMenus({ menuTypes: ['food', 'lunch'], enabled });
};

export const useRistoranteDrinksMenu = (enabled = true) => {
  return useRistoranteMenus({ menuTypes: ['drinks'], enabled });
};

export const useRistoranteAllMenus = (enabled = true) => {
  return useRistoranteMenus({ enabled });
};
