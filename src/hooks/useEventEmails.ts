import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EventEmail = {
  id: string;
  source: "inbound" | "outbound";
  message_id: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  date_at: string;
  imap_status: string | null;
  status_changed_at: string | null;
  imap_folder: string | null;
  is_hidden: boolean;
  is_excluded: boolean;
  has_attachments: boolean;
  attachment_count: number;
};

export type EventEmailFilter = {
  id: string;
  event_id: string;
  filter_type: "from_email" | "subject_contains" | "thread_root";
  filter_value: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
};

export function useEventEmails(eventId: string | undefined, includeHidden = false) {
  const [emails, setEmails] = useState<EventEmail[]>([]);
  const [filters, setFilters] = useState<EventEmailFilter[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const [emailsRes, filtersRes] = await Promise.all([
      supabase.rpc("get_event_emails", {
        p_event_id: eventId,
        p_include_hidden: includeHidden,
      }),
      supabase
        .from("event_email_filters")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);
    if (!emailsRes.error) setEmails((emailsRes.data ?? []) as EventEmail[]);
    if (!filtersRes.error) setFilters((filtersRes.data ?? []) as EventEmailFilter[]);
    setLoading(false);
  }, [eventId, includeHidden]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Realtime: re-fetch on changes to links/filters/inbox status
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`event-emails-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_email_links", filter: `event_id=eq.${eventId}` },
        () => void refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_email_filters", filter: `event_id=eq.${eventId}` },
        () => void refetch()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inbox_emails" },
        () => void refetch()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, refetch]);

  return { emails, filters, loading, refetch };
}