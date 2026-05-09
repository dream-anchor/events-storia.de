import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UnassignedEmail = {
  id: string;
  message_id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  date_received: string;
  date_sent: string | null;
  has_attachments: boolean;
  attachment_count: number;
  imap_status: string;
  imap_folder: string;
  is_hidden: boolean;
  hidden_reason: string | null;
};

export function useUnassignedInboxCount() {
  return useQuery({
    queryKey: ["unassigned-inbox-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("unassigned_inbox_emails" as any)
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}

export function useUnassignedInbox() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["unassigned-inbox"],
    queryFn: async (): Promise<UnassignedEmail[]> => {
      const { data, error } = await supabase
        .from("unassigned_inbox_emails" as any)
        .select(
          "id, message_id, from_email, from_name, subject, body_text, body_html, date_received, date_sent, has_attachments, attachment_count, imap_status, imap_folder, is_hidden, hidden_reason"
        )
        .order("date_received", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as UnassignedEmail[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("unassigned-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_emails" }, () => {
        qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
        qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_email_links" }, () => {
        qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
        qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function useHiddenInbox() {
  return useQuery({
    queryKey: ["hidden-inbox"],
    queryFn: async (): Promise<UnassignedEmail[]> => {
      const { data, error } = await supabase
        .from("inbox_emails")
        .select(
          "id, message_id, from_email, from_name, subject, body_text, body_html, date_received, date_sent, has_attachments, attachment_count, imap_status, imap_folder, is_hidden, hidden_reason"
        )
        .eq("is_hidden", true)
        .order("date_received", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as UnassignedEmail[];
    },
  });
}

export type BlocklistEntry = {
  from_email: string;
  blocked_at: string;
  reason: string | null;
};

export function useBlocklist() {
  return useQuery({
    queryKey: ["sender-blocklist"],
    queryFn: async (): Promise<BlocklistEntry[]> => {
      const { data, error } = await supabase
        .from("email_sender_blocklist")
        .select("from_email, blocked_at, reason")
        .order("blocked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlocklistEntry[];
    },
  });
}