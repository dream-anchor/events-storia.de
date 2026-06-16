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
  /**
   * Optional: vom Kunden geäußerte Preisvorstellung / Budget.
   * Wird nicht von der KI berechnet, sondern aus dem Chat extrahiert
   * (z. B. "ca. 35 EUR pro Person", "Gesamtbudget ca. 1.500 EUR",
   * "keine Angabe"). Wird im Hook aus mehreren möglichen Quellen
   * zusammengeführt (draft.budget, extraction.budget, metadata.ai_draft …).
   */
  customer_budget?: string | null;
}

export interface AiDraftResult {
  conversationId: string;
  updatedAt: string | null;
  draft: AiDraft;
}

function pickBudget(...sources: unknown[]): string | null {
  for (const s of sources) {
    if (typeof s === "string") {
      const v = s.trim();
      if (
        v.length > 0 &&
        v.toLowerCase() !== "null" &&
        v.toLowerCase() !== "undefined"
      ) {
        return v;
      }
    }
  }
  return null;
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
      const md = row.metadata as Record<string, unknown> & {
        draft?: AiDraft & Record<string, unknown>;
        ai_draft?: Record<string, unknown>;
        extraction?: Record<string, unknown>;
        extracted?: Record<string, unknown>;
      };
      const draft = { ...(md.draft as AiDraft) } as AiDraft;

      // Latest extraction for this conversation — primary source for the
      // customer-provided budget answer.
      const { data: extRow } = await supabase
        .from("ai_extractions")
        .select("extracted")
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const extracted =
        extRow && typeof extRow.extracted === "object" && extRow.extracted
          ? (extRow.extracted as Record<string, unknown>)
          : null;

      const aiDraftMirror =
        md.ai_draft && typeof md.ai_draft === "object"
          ? (md.ai_draft as Record<string, unknown>)
          : null;
      const aiDraftExtraction =
        aiDraftMirror?.extraction && typeof aiDraftMirror.extraction === "object"
          ? (aiDraftMirror.extraction as Record<string, unknown>)
          : null;
      const draftExtraction =
        (draft as unknown as { extraction?: Record<string, unknown> })
          .extraction ?? null;

      draft.customer_budget = pickBudget(
        (draft as Record<string, unknown>).budget,
        draftExtraction?.budget,
        extracted?.budget,
        aiDraftMirror?.budget,
        aiDraftExtraction?.budget,
        (md.extraction as Record<string, unknown> | undefined)?.budget,
        (md.extracted as Record<string, unknown> | undefined)?.budget,
      );

      return {
        conversationId: row.id,
        updatedAt: row.updated_at ?? row.created_at ?? null,
        draft,
      };
    },
  });
}
