import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Liefert ein Set von Inquiry-IDs (entity_id), für die in `email_delivery_logs`
 * mindestens ein Eintrag mit status='bounced' oder 'failed' existiert.
 * Wird im Kanban verwendet, um betroffene Karten rot zu umranden und mit
 * einem Alarm-Emoji zu markieren.
 */
export function useFailedDeliveryInquiries(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("email_delivery_logs")
        .select("entity_id, entity_type, status")
        .eq("entity_type", "event_inquiry")
        .in("status", ["bounced", "failed"]);
      if (error || cancelled || !data) return;
      setIds(new Set(data.map((r: any) => r.entity_id).filter(Boolean)));
    };
    load();

    // Realtime: bei neuen Bounce-/Fail-Einträgen sofort nachziehen
    const channel = supabase
      .channel("email-delivery-failures")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "email_delivery_logs" },
        (payload: any) => {
          const row = payload.new;
          if (
            row?.entity_type === "event_inquiry" &&
            (row.status === "bounced" || row.status === "failed") &&
            row.entity_id
          ) {
            setIds((prev) => {
              if (prev.has(row.entity_id)) return prev;
              const next = new Set(prev);
              next.add(row.entity_id);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return ids;
}