import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PublishedStandardMenu {
  id: string;
  menu_type: 'lunch' | 'food' | 'drinks';
  title: string | null;
  title_en: string | null;
  sort_order: number | null;
}

export const usePublishedStandardMenus = () => {
  return useQuery({
    queryKey: ['published-standard-menus'],
    queryFn: async (): Promise<PublishedStandardMenu[]> => {
      const { data, error } = await supabase
        .from('menus')
        .select('id, menu_type, title, title_en, sort_order')
        .in('menu_type', ['lunch', 'food', 'drinks'])
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as PublishedStandardMenu[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
