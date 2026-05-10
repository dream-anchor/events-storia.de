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
  suggested_event_id: string | null;
  suggestion_category: "match" | "new_inquiry" | "irrelevant" | "unclear" | null;
  suggestion_confidence: "high" | "medium" | "low" | null;
  suggestion_reasoning: string | null;
  suggestion_method: "heuristic" | "llm" | null;
  suggestion_generated_at: string | null;
};

export type DraftEmail = {
  id: string;
  imap_uid: number | null;
  imap_folder: string;
  imap_status: string;
  draft_uid_key: string | null;
  to_emails: string[];
  cc_emails: string[];
  reply_to_email: string | null;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  date_sent: string | null;
  date_received: string;
  updated_at: string;
  has_attachments: boolean;
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
          "id, message_id, from_email, from_name, subject, body_text, body_html, date_received, date_sent, has_attachments, attachment_count, imap_status, imap_folder, is_hidden, hidden_reason, suggested_event_id, suggestion_category, suggestion_confidence, suggestion_reasoning, suggestion_method, suggestion_generated_at"
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
          "id, message_id, from_email, from_name, subject, body_text, body_html, date_received, date_sent, has_attachments, attachment_count, imap_status, imap_folder, is_hidden, hidden_reason, suggested_event_id, suggestion_category, suggestion_confidence, suggestion_reasoning, suggestion_method, suggestion_generated_at"
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

export function useDraftsInbox() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["drafts-inbox"],
    queryFn: async (): Promise<DraftEmail[]> => {
      const { data, error } = await supabase
        .from("inbox_emails")
        .select(
          "id, imap_uid, imap_folder, imap_status, draft_uid_key, to_emails, cc_emails, reply_to_email, from_email, subject, body_text, body_html, date_sent, date_received, updated_at, has_attachments"
        )
        .eq("direction", "draft")
        .eq("imap_status", "present")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as DraftEmail[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("drafts-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_emails" }, () => {
        qc.invalidateQueries({ queryKey: ["drafts-inbox"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}