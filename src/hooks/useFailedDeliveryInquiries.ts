import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FAILURE_STATUSES } from "@/hooks/useEmailFailures";

function isUnresolvedCustomerDeliveryFailure(row: any): boolean {
  if (!FAILURE_STATUSES.includes(row.status)) return false;
  if (row.provider === "whatsapp_meta") return false;
  if (typeof row.recipient_email === "string" && row.recipient_email.startsWith("whatsapp:")) return false;
  return !row.metadata?.resolved_at;
}

/**
 * Liefert ein Set von Inquiry-IDs (entity_id), für die in `email_delivery_logs`
 * mindestens ein nicht erledigter Zustellfehler existiert.
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
        .select("entity_id, entity_type, status, metadata, provider, recipient_email")
        .eq("entity_type", "event_inquiry")
        .in("status", FAILURE_STATUSES as unknown as string[]);
      if (error || cancelled || !data) return;
      setIds(new Set(data.filter(isUnresolvedCustomerDeliveryFailure).map((r: any) => r.entity_id).filter(Boolean)));
    };
    load();

    // Realtime: bei neuen, erledigten oder gelöschten Fehlern überall sofort nachziehen
    const channel = supabase
      .channel("email-delivery-failures-inquiry-index")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_delivery_logs" },
        load
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return ids;
}