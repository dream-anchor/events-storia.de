import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Snapshot eines Eintrags in `inquiry_offer_options` zum Zeitpunkt des Versands.
 * Spiegelt 1:1 die DB-Spalten — wir speichern beim Senden den vollen Row-Snapshot
 * (siehe SmartInquiryEditor.tsx: handleSend → fullOptions).
 */
export interface OfferOptionSnapshot {
  id: string;
  inquiry_id: string;
  option_label: string;
  offer_mode: string | null;
  package_id: string | null;
  guest_count: number;
  selected_quantity: number | null;
  total_amount: number;
  menu_selection: Record<string, unknown> | null;
  stripe_payment_link_url: string | null;
  stripe_payment_link_id: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  offer_version: number | null;
  created_in_version: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OfferHistoryEntry {
  id: string;
  inquiry_id: string;
  version: number;
  sent_at: string;
  sent_by: string | null;
  email_content: string | null;
  /** Vollständiges HTML der versendeten Mail (Logo, Header, Buttons …).
   *  Wird seit April 2026 von `send-offer-email` archiviert.
   *  Alt-Versionen können `null` sein → Frontend fällt auf email_content zurück. */
  email_html: string | null;
  /** Tatsächlich versendetes HTML aus dem Mailverlauf.
   *  Für Bestands-Versionen die verlässlichste 1:1-Quelle. */
  delivered_email_html?: string | null;
  pdf_url: string | null;
  options_snapshot: OfferOptionSnapshot[];
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

/**
 * Lädt einen einzelnen History-Eintrag (für die Archiv-Detail-Seite).
 */
export function useOfferHistoryVersion(inquiryId: string, version: number | null) {
  return useQuery({
    queryKey: ["offer-history", inquiryId, version],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_offer_history" as never)
        .select("*")
        .eq("inquiry_id", inquiryId)
        .eq("version", version!)
        .maybeSingle();
      if (error) throw error;

      const entry = (data || null) as unknown as OfferHistoryEntry | null;
      if (!entry) return null;

      const sentAtIso = entry.sent_at;
      const historyWindowStart = new Date(new Date(sentAtIso).getTime() - 10 * 60 * 1000).toISOString();
      const historyWindowEnd = new Date(new Date(sentAtIso).getTime() + 10 * 60 * 1000).toISOString();

      const { data: candidateEmails, error: emailErr } = await supabase
        .from("v2_event_emails" as never)
        .select("id, body_html, subject, created_at, sent_at")
        .eq("event_id", inquiryId)
        .eq("direction", "outbound")
        .not("body_html", "is", null)
        .gte("sent_at", historyWindowStart)
        .lte("sent_at", historyWindowEnd)
        .order("sent_at", { ascending: false });

      if (emailErr) throw emailErr;

      const bestMatch = ((candidateEmails || []) as Array<{
        body_html: string | null;
        created_at?: string | null;
        sent_at?: string | null;
      }>).sort((a, b) => {
        const aTs = new Date(a.sent_at || a.created_at || 0).getTime();
        const bTs = new Date(b.sent_at || b.created_at || 0).getTime();
        return Math.abs(aTs - new Date(sentAtIso).getTime()) - Math.abs(bTs - new Date(sentAtIso).getTime());
      })[0];

      return {
        ...entry,
        delivered_email_html: bestMatch?.body_html ?? null,
      } as OfferHistoryEntry;
    },
    enabled: !!inquiryId && version != null && !Number.isNaN(version),
  });
}
