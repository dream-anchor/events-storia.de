import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTestMode } from "@/contexts/TestModeContext";

// =====================================================================
// Conversion-Auswertung: Anfrage -> Buchung
// Liest v2_events direkt (kleine Datenmenge) und aggregiert client-seitig.
// Stage-"reached" wird aus dem aktuellen Status-Rang + Zeitstempeln
// abgeleitet. Sobald v2_event_changelog (Trigger ab 2026-06-24) genug
// Historie gesammelt hat, kann "reached" exakt aus dem Max-Rang kommen.
// =====================================================================

export type EventStatus =
  | "inquiry" | "offer_draft" | "offer_sent" | "offer_chosen"
  | "paid" | "completed" | "offer_declined" | "cancelled"
  | "payment_failed" | "no_response";

const STAGE_RANK: Record<string, number> = {
  inquiry: 0, offer_draft: 1, offer_sent: 2,
  offer_chosen: 3, paid: 4, completed: 5,
};

export const LOSS_REASON_LABELS: Record<string, string> = {
  too_expensive: "Zu teuer",
  date_unavailable: "Termin nicht frei",
  no_response: "Keine Rückmeldung",
  booked_elsewhere: "Woanders gebucht",
  plan_cancelled: "Anlass abgesagt",
  not_qualified: "Unpassend / Spam",
  other: "Sonstiges",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  manual: "Manuell",
  email_inbound: "E-Mail",
  phone: "Telefon",
  catering_form: "Catering-Formular",
};

export interface ConversionRange {
  /** ISO-Start (inkl.) oder null = ohne Untergrenze */
  from: string | null;
  /** ISO-Ende (exkl.) oder null = ohne Obergrenze */
  to: string | null;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** Conversion ab vorheriger Stufe in % */
  stepRate: number;
  /** Conversion ab Anfrage in % */
  totalRate: number;
}

export interface Breakdown {
  key: string;
  label: string;
  inquiries: number;
  booked: number;  // offer_chosen erreicht
  paid: number;
  bookedRate: number;
  paidRate: number;
  revenueCents: number;
}

export interface ConversionData {
  totals: {
    inquiries: number;
    offersSent: number;
    offersOpened: number;
    booked: number;   // -> offer_chosen erreicht
    paid: number;     // -> paid erreicht
    open: number;     // noch in Bearbeitung, kein Endzustand
  };
  rates: {
    offerSentRate: number;   // Anfrage -> Angebot raus
    openRate: number;        // Angebot raus -> geöffnet
    bookedRate: number;      // Zusage-Rate (Anfrage -> gebucht)
    paidRate: number;        // Fix-Rate (Anfrage -> bezahlt)
    openToBookedRate: number;// geöffnet -> gebucht
  };
  funnel: FunnelStage[];
  lost: {
    total: number;
    cancelled: number;
    declined: number;
    noResponse: number;
    reasons: Array<{ key: string; label: string; count: number }>;
    missingReason: number;
  };
  bySource: Breakdown[];
  byStaff: Breakdown[];
  /** Verlorene Anfragen ohne erfassten Grund — zum Nachtragen im Dashboard */
  lossInbox: Array<{ id: string; label: string; status: string; createdAt: string }>;
  timing: {
    avgDaysToOffer: number | null;
    avgDaysOfferToBooked: number | null;
    medianDaysToOffer: number | null;
  };
  revenue: {
    bookedCents: number;
    paidCents: number;
    avgOrderCents: number | null;
  };
}

interface EventRow {
  id: string;
  status: string;
  source: string | null;
  assigned_to: string | null;
  amount_total: number | null;
  guest_count: number | null;
  created_at: string;
  status_changed_at: string | null;
  offer_sent_at: string | null;
  offer_first_viewed_at: string | null;
  offer_view_count: number | null;
  loss_reason: string | null;
  is_test: boolean | null;
  v2_customers?: { name: string | null; company: string | null } | null;
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function daysBetween(a: string, b: string): number {
  return (new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function useConversionData(range: ConversionRange) {
  const { showTestData } = useTestMode();
  return useQuery<ConversionData>({
    queryKey: ["conversion-data", range.from, range.to, showTestData],
    refetchInterval: 120_000,
    queryFn: async () => {
      let q = supabase
        .from("v2_events")
        .select(
          "id, status, source, assigned_to, amount_total, guest_count, created_at, status_changed_at, offer_sent_at, offer_first_viewed_at, offer_view_count, loss_reason, is_test, v2_customers ( name, company )"
        );
      if (range.from) q = q.gte("created_at", range.from);
      if (range.to) q = q.lt("created_at", range.to);
      if (!showTestData) q = q.neq("is_test", true);

      const { data, error } = await q;
      if (error) throw error;
      const rows = ((data || []) as unknown as EventRow[]);

      const inquiries = rows.length;
      const rankOf = (s: string) => STAGE_RANK[s] ?? -1;

      // Stage-"reached"-Zähler
      const reachedOfferSent = rows.filter(
        (r) => r.offer_sent_at != null || rankOf(r.status) >= 2
      ).length;
      const reachedOpened = rows.filter((r) => r.offer_first_viewed_at != null).length;
      const reachedBooked = rows.filter((r) => rankOf(r.status) >= 3).length;
      const reachedPaid = rows.filter((r) => rankOf(r.status) >= 4).length;
      const reachedCompleted = rows.filter((r) => rankOf(r.status) >= 5).length;

      const TERMINAL_LOST = new Set(["offer_declined", "cancelled", "no_response", "payment_failed"]);
      const openCount = rows.filter(
        (r) => !TERMINAL_LOST.has(r.status) && rankOf(r.status) < 3
      ).length;

      const funnel: FunnelStage[] = [
        { key: "inquiry", label: "Anfrage", count: inquiries },
        { key: "offer_sent", label: "Angebot verschickt", count: reachedOfferSent },
        { key: "opened", label: "Angebot geöffnet", count: reachedOpened },
        { key: "booked", label: "Gebucht (Zusage)", count: reachedBooked },
        { key: "paid", label: "Bezahlt (fix)", count: reachedPaid },
        { key: "completed", label: "Durchgeführt", count: reachedCompleted },
      ].map((s, i, arr) => ({
        ...s,
        stepRate: i === 0 ? 100 : pct(s.count, arr[i - 1].count),
        totalRate: pct(s.count, inquiries),
      }));

      // Verloren + Gründe
      const cancelled = rows.filter((r) => r.status === "cancelled").length;
      const declined = rows.filter((r) => r.status === "offer_declined").length;
      const noResponse = rows.filter((r) => r.status === "no_response").length;
      const lostRows = rows.filter((r) => TERMINAL_LOST.has(r.status));
      const reasonMap = new Map<string, number>();
      let missingReason = 0;
      lostRows.forEach((r) => {
        if (!r.loss_reason) { missingReason += 1; return; }
        reasonMap.set(r.loss_reason, (reasonMap.get(r.loss_reason) || 0) + 1);
      });
      const reasons = Array.from(reasonMap.entries())
        .map(([key, count]) => ({ key, label: LOSS_REASON_LABELS[key] || key, count }))
        .sort((a, b) => b.count - a.count);

      const labelOf = (r: EventRow) =>
        r.v2_customers?.company?.trim() ||
        r.v2_customers?.name?.trim() ||
        "Unbenannte Anfrage";
      const lossInbox = lostRows
        .filter((r) => !r.loss_reason)
        .map((r) => ({ id: r.id, label: labelOf(r), status: r.status, createdAt: r.created_at }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // Breakdown-Helper
      const buildBreakdown = (
        keyFn: (r: EventRow) => string | null,
        labelFn: (k: string) => string,
        fallbackLabel: string
      ): Breakdown[] => {
        const groups = new Map<string, EventRow[]>();
        rows.forEach((r) => {
          const k = keyFn(r) || "__none__";
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k)!.push(r);
        });
        return Array.from(groups.entries())
          .map(([k, grp]) => {
            const booked = grp.filter((r) => rankOf(r.status) >= 3).length;
            const paid = grp.filter((r) => rankOf(r.status) >= 4).length;
            const revenueCents = grp
              .filter((r) => rankOf(r.status) >= 4)
              .reduce((s, r) => s + Math.round((r.amount_total || 0) * 100), 0);
            return {
              key: k,
              label: k === "__none__" ? fallbackLabel : labelFn(k),
              inquiries: grp.length,
              booked,
              paid,
              bookedRate: pct(booked, grp.length),
              paidRate: pct(paid, grp.length),
              revenueCents,
            };
          })
          .sort((a, b) => b.inquiries - a.inquiries);
      };

      const bySource = buildBreakdown(
        (r) => r.source,
        (k) => SOURCE_LABELS[k] || k,
        "Unbekannt"
      );
      const byStaff = buildBreakdown(
        (r) => r.assigned_to,
        (k) => k,
        "Nicht zugewiesen"
      );

      // Timing
      const daysToOffer = rows
        .filter((r) => r.offer_sent_at)
        .map((r) => daysBetween(r.offer_sent_at!, r.created_at))
        .filter((d) => d >= 0 && d < 365);
      const daysOfferToBooked = rows
        .filter((r) => r.offer_sent_at && rankOf(r.status) >= 3 && r.status_changed_at)
        .map((r) => daysBetween(r.status_changed_at!, r.offer_sent_at!))
        .filter((d) => d >= 0 && d < 365);
      const avg = (arr: number[]) =>
        arr.length ? Math.round((arr.reduce((s, d) => s + d, 0) / arr.length) * 10) / 10 : null;

      // Umsatz
      const bookedCents = rows
        .filter((r) => rankOf(r.status) >= 3)
        .reduce((s, r) => s + Math.round((r.amount_total || 0) * 100), 0);
      const paidCents = rows
        .filter((r) => rankOf(r.status) >= 4)
        .reduce((s, r) => s + Math.round((r.amount_total || 0) * 100), 0);

      return {
        totals: {
          inquiries,
          offersSent: reachedOfferSent,
          offersOpened: reachedOpened,
          booked: reachedBooked,
          paid: reachedPaid,
          open: openCount,
        },
        rates: {
          offerSentRate: pct(reachedOfferSent, inquiries),
          openRate: pct(reachedOpened, reachedOfferSent),
          bookedRate: pct(reachedBooked, inquiries),
          paidRate: pct(reachedPaid, inquiries),
          openToBookedRate: pct(reachedBooked, reachedOpened),
        },
        funnel,
        lost: {
          total: lostRows.length,
          cancelled,
          declined,
          noResponse,
          reasons,
          missingReason,
        },
        bySource,
        byStaff,
        lossInbox,
        timing: {
          avgDaysToOffer: avg(daysToOffer),
          avgDaysOfferToBooked: avg(daysOfferToBooked),
          medianDaysToOffer: median(daysToOffer),
        },
        revenue: {
          bookedCents,
          paidCents,
          avgOrderCents: reachedPaid ? Math.round(paidCents / reachedPaid) : null,
        },
      };
    },
  });
}
