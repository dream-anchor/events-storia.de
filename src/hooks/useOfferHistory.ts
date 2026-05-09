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
  pdf_url: string | null;
  options_snapshot: OfferOptionSnapshot[];
  /** E-Mail-Adresse, an die diese Version verschickt wurde.
   *  Wird über das nächstgelegene outbound-Mail-Log (±5 min) ermittelt. */
  recipient_email?: string | null;
}

export function useOfferHistory(inquiryId: string) {
  return useQuery({
    queryKey: ["offer-history", inquiryId],
    queryFn: async () => {
      const [historyRes, mailsRes] = await Promise.all([
        supabase
          .from("inquiry_offer_history" as never)
          .select("*")
          .eq("inquiry_id", inquiryId)
          .order("version", { ascending: false }),
        supabase
          .from("email_messages" as never)
          .select("to_email, created_at, subject")
          .eq("inquiry_id", inquiryId)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false }),
      ]);

      if (historyRes.error) throw historyRes.error;
      const history = (historyRes.data || []) as unknown as OfferHistoryEntry[];
      const mails = ((mailsRes.data as unknown) as Array<{
        to_email: string;
        created_at: string;
        subject: string | null;
      }>) || [];

      // Bevorzugt offer-bezogene Mails (Subject enthält "Angebot" oder "Offer"),
      // matche per nächstgelegener Sendezeit (Toleranz: ±5 Minuten).
      const offerMails = mails.filter((m) =>
        /angebot|offer/i.test(m.subject || ""),
      );
      const pool = offerMails.length > 0 ? offerMails : mails;

      return history.map((entry) => {
        if (!pool.length) return entry;
        const target = new Date(entry.sent_at).getTime();
        let best: { to_email: string; diff: number } | null = null;
        for (const m of pool) {
          const diff = Math.abs(new Date(m.created_at).getTime() - target);
          if (!best || diff < best.diff) best = { to_email: m.to_email, diff };
        }
        const recipient_email =
          best && best.diff <= 5 * 60 * 1000 ? best.to_email : null;
        return { ...entry, recipient_email };
      });
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
      return entry;
    },
    enabled: !!inquiryId && version != null && !Number.isNaN(version),
  });
}
