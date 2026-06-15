import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiDraftPackageSuggestion {
  package_id?: string | null;
  name?: string | null;
  guests?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
  rationale?: string | null;
}

export interface AiDraftItemSuggestion {
  menu_item_id?: string | null;
  name?: string | null;
  qty?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  subtotal?: number | null;
  category?: string | null;
}

export interface AiDraftCustomItem {
  label?: string | null;
  note?: string | null;
}

export interface AiDraftEstimate {
  currency?: string | null;
  low?: number | null;
  high?: number | null;
  basis?: string | null;
  disclaimer?: string | null;
}

export interface AiDraft {
  version?: number;
  status?: string;
  summary?: string | null;
  open_questions?: string[];
  suggested_packages?: AiDraftPackageSuggestion[];
  suggested_items?: AiDraftItemSuggestion[];
  custom_items?: AiDraftCustomItem[];
  estimate?: AiDraftEstimate;
  generated_at?: string | null;
  model?: string | null;
}

export interface AiDraftResult {
  conversationId: string;
  updatedAt: string | null;
  draft: AiDraft;
}

export function useAiDraft(inquiryId: string | null | undefined) {
  return useQuery<AiDraftResult | null>({
    queryKey: ["ai-draft", inquiryId],
    enabled: !!inquiryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, updated_at, created_at, metadata")
        .eq("inquiry_id", inquiryId!)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const row = (data ?? []).find((r) => {
        const md = r.metadata as Record<string, unknown> | null;
        const d = md && typeof md === "object" ? (md as { draft?: unknown }).draft : null;
        return !!d && typeof d === "object";
      });
      if (!row) return null;
      const md = row.metadata as { draft?: AiDraft };
      return {
        conversationId: row.id,
        updatedAt: row.updated_at ?? row.created_at ?? null,
        draft: md.draft as AiDraft,
      };
    },
  });
}
