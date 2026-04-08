import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RistoranteImportItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  priceDisplay: string | null;
}

export interface RistoranteTastingMenu extends RistoranteImportItem {
  winePairing: RistoranteImportItem | null;
}

export interface RistoranteCourseCategory {
  categoryName: string;
  items: RistoranteImportItem[];
}

export interface RistoranteLunchData {
  packageItems: RistoranteImportItem[];
  courses: RistoranteCourseCategory[];
}

export interface RistoranteDinnerData {
  tastingMenus: RistoranteTastingMenu[];
  alaCarte: RistoranteCourseCategory[];
}

export interface RistoranteCompleteMenusResponse {
  lunch: RistoranteLunchData | null;
  dinner: RistoranteDinnerData | null;
  error?: string;
}

export const useRistoranteCompleteMenus = (enabled = true) => {
  return useQuery({
    queryKey: ['ristorante-complete-menus'],
    queryFn: async (): Promise<RistoranteCompleteMenusResponse> => {
      const { data, error } = await supabase.functions.invoke('fetch-ristorante-complete-menus');

      if (error) {
        throw new Error(error.message || 'Failed to fetch complete restaurant menus');
      }

      return data as RistoranteCompleteMenusResponse;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 Minuten
    retry: 2,
  });
};
