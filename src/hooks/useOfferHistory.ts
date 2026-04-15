import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OfferHistoryEntry {
  id: string;
  version: number;
  sent_at: string;
  sent_by: string | null;
  email_content: string | null;
  pdf_url: string | null;
  options_snapshot: {
    optionLabel: string;
    offerMode: string;
    guestCount: number;
    totalAmount: number;
    budgetPerPerson: number | null;
    menuSelection?: {
      courses?: { courseLabel: string; itemName: string }[];
      drinks?: { drinkLabel: string; selectedChoice: string | null }[];
    };
  }[];
}

export function useOfferHistory(inquiryId: string) {
  return useQuery({
    queryKey: ["offer-history", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_offer_history" as never)
        .select("*")
        .eq("inquiry_id", inquiryId)
        .order("version", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as OfferHistoryEntry[];
    },
    enabled: !!inquiryId,
  });
}
