import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TranslateInput {
  name?: string;
  description?: string;
  sourceLang?: string;
  targetLang?: string;
}

interface TranslateResult {
  name_en?: string | null;
  description_en?: string | null;
  [key: string]: string | null | undefined;
}

export const useTranslateMenuText = () => {
  return useMutation({
    mutationFn: async (input: TranslateInput): Promise<TranslateResult> => {
      const { name, description, sourceLang = 'de', targetLang = 'en' } = input;

      if (!name && !description) {
        throw new Error('Keine Texte zum Übersetzen');
      }

      const { data, error } = await supabase.functions.invoke('translate-menu-text', {
        body: {
          texts: { name, description },
          sourceLang,
          targetLang,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as TranslateResult;
    },
  });
};
