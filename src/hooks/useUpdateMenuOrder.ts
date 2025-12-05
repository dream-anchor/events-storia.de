import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MenuOrderUpdate {
  id: string;
  sort_order: number;
}

export const useUpdateMenuOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: MenuOrderUpdate[]) => {
      // Update each menu's sort_order
      for (const update of updates) {
        const { error } = await supabase
          .from('menus')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menus'] });
      queryClient.invalidateQueries({ queryKey: ['special-menus'] });
      queryClient.invalidateQueries({ queryKey: ['published-special-menus'] });
    },
  });
};
