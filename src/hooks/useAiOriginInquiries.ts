import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Liefert ein Set von v2_events-IDs, zu denen eine `ai_conversations`-Zeile
 * mit gesetzter `inquiry_id` existiert. Wird in der Anfragen-Übersicht
 * (Kanban und Tabelle) verwendet, um Anfragen zu markieren, die über die
 * öffentliche KI-Bar entstanden sind.
 *
 * Bewusst nur ein eindeutiges Signal (ai_conversations → inquiry_id),
 * keine Heuristik über Name/E-Mail/Text.
 */
export function useAiOriginInquiries(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("inquiry_id")
        .not("inquiry_id", "is", null);
      if (error) {
        console.error("KI-Badge konnte nicht geladen werden:", error);
        return;
      }
      if (cancelled || !data) return;
      setIds(
        new Set(
          data
            .map((r: { inquiry_id: string | null }) => r.inquiry_id)
            .filter((x): x is string => typeof x === "string" && x.length > 0),
        ),
      );
    };
    load();

    const channel = supabase
      .channel("ai-origin-inquiries-index")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_conversations" },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return ids;
}