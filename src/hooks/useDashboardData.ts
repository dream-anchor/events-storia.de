import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTestMode } from "@/contexts/TestModeContext";

export interface DashOperation {
  id: string;
  kind: "catering" | "booking" | "inquiry";
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm
  customerName: string;
  companyName: string | null;
  guestCount: number | null;
  phone: string | null;
  address: string | null;
  isPickup: boolean;
  status: string;
  paymentStatus: string | null;
  menuConfirmed: boolean | null;
  totalAmount: number | null;
  navigateTo: string;
}

export interface DashInbox {
  id: string;
  kind: "inquiry" | "catering" | "group";
  customerName: string;
  subtitle: string | null;
  createdAt: string;
  ageDays: number;
  isStale: boolean;
  navigateTo: string;
  unanswered?: boolean;
  hoursSince?: number;
}

export interface DashboardData {
  operations: DashOperation[]; // today + future (next 7d)
  inbox: DashInbox[];
  staleInquiries: DashInbox[];
  overduePayments: Array<{
    id: string;
    inquiryId: string;
    customerName: string;
    amountCents: number;
    daysOverdue: number;
  }>;
  weekStats: {
    eventsCount: number;
    cateringCount: number;
    guestsCount: number;
    revenueCents: number;
    paidCents: number;
  };
  byDay: Record<string, { events: number; catering: number; guests: number; revenueCents: number }>;
  nextWeek: { count: number; guests: number; risks: number };
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

export function useDashboardData() {
  const { showTestData } = useTestMode();
  return useQuery<DashboardData>({
    queryKey: ["dashboard-data", showTestData],
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = ymd(today);
      const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
      const in14Str = ymd(in14);
      const past48 = new Date(today); past48.setHours(today.getHours() - 48);

      // Inquiries (events): future & recent
      let inqQ = supabase
        .from("event_inquiries")
        .select("id, contact_name, company_name, email, phone, guest_count, event_type, preferred_date, time_slot, status, offer_phase, offer_sent_at, created_at, archived_at, is_test, location_street, location_city, venue, location_name, total_amount" as never)
        .is("archived_at", null);
      if (!showTestData) inqQ = inqQ.neq("is_test", true);

      // Catering orders
      let catQ = supabase
        .from("catering_orders")
        .select("id, order_number, customer_name, customer_phone, company_name, is_pickup, desired_date, desired_time, items, total_amount, status, payment_status, delivery_street, delivery_zip, delivery_city, created_at, is_test" as never)
        .gte("desired_date", todayStr)
        .lte("desired_date", in14Str)
        .neq("status", "cancelled");
      if (!showTestData) catQ = catQ.neq("is_test", true);

      // Catering: recent inbox (last 48h, any date)
      let catInboxQ = supabase
        .from("catering_orders")
        .select("id, order_number, customer_name, company_name, total_amount, status, created_at, is_test" as never)
        .gte("created_at", past48.toISOString())
        .neq("status", "cancelled");
      if (!showTestData) catInboxQ = catInboxQ.neq("is_test", true);

      // Event bookings (next 14 days)
      const bookQ = supabase
        .from("event_bookings")
        .select("id, booking_number, customer_name, company_name, phone, guest_count, event_date, event_time, status, payment_status, menu_confirmed, total_amount, source_inquiry_id" as never)
        .gte("event_date", todayStr)
        .lte("event_date", in14Str)
        .not("status", "in", "(cancelled,refunded)");

      // Reisegruppen-Events (jetzt in v2_events) — letzte 48h
      const groupQ = supabase
        .from("v2_events")
        .select("id, guest_count, date, status, created_at, v2_customers ( name, company )")
        .eq("service_type", "group")
        .gte("created_at", past48.toISOString())
        .not("status", "in", "(cancelled,offer_declined)");

      // Overdue payments
      const payQ = supabase
        .from("event_payments_enriched" as never)
        .select("id, inquiry_id, amount_cents, computed_status, effective_due_date, customer_name");

      const [inqRes, catRes, catInboxRes, bookRes, groupRes, payRes] = await Promise.all([
        inqQ, catQ, catInboxQ, bookQ, groupQ, payQ,
      ]);

      const inquiries = (inqRes.data || []) as any[];
      const cateringAll = (catRes.data || []) as any[];
      const cateringInbox = (catInboxRes.data || []) as any[];
      const bookings = (bookRes.data || []) as any[];
      const groups = (groupRes.data || []) as any[];
      const payments = (payRes.data || []) as any[];

      // ── Replies map: which inquiry_ids have at least one outbound mail (last 14d) ──
      const recentInqIds = inquiries
        .filter((e: any) => new Date(e.created_at) >= past48 || (e.preferred_date && String(e.preferred_date).split("T")[0] >= todayStr))
        .map((e: any) => e.id);
      const repliedSet = new Set<string>();
      if (recentInqIds.length > 0) {
        const { data: replyRows } = await supabase
          .from("email_messages" as never)
          .select("inquiry_id")
          .in("inquiry_id", recentInqIds)
          .eq("direction", "outbound");
        ((replyRows || []) as any[]).forEach(r => r.inquiry_id && repliedSet.add(r.inquiry_id));
      }

      // ── Operations: today + next 7 days ──
      const operations: DashOperation[] = [];
      const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
      const in7Str = ymd(in7);

      cateringAll.forEach(c => {
        if (!c.desired_date || c.desired_date > in7Str) return;
        const addr = c.is_pickup ? "Abholung" : [c.delivery_street, c.delivery_zip, c.delivery_city].filter(Boolean).join(" ");
        const items = Array.isArray(c.items) ? c.items : [];
        const guests = items.reduce((s: number, it: any) => s + (Number(it.persons) || Number(it.quantity) || 0), 0);
        operations.push({
          id: c.id,
          kind: "catering",
          date: c.desired_date,
          time: c.desired_time ? String(c.desired_time).substring(0, 5) : null,
          customerName: c.customer_name,
          companyName: c.company_name,
          guestCount: guests || null,
          phone: c.customer_phone,
          address: addr || null,
          isPickup: !!c.is_pickup,
          status: c.status || "pending",
          paymentStatus: c.payment_status,
          menuConfirmed: null,
          totalAmount: c.total_amount,
          navigateTo: `/admin/catering/${c.id}`,
        });
      });

      bookings.forEach(b => {
        if (!b.event_date || b.event_date > in7Str) return;
        operations.push({
          id: b.id,
          kind: "booking",
          date: b.event_date,
          time: b.event_time ? String(b.event_time).substring(0, 5) : null,
          customerName: b.customer_name,
          companyName: b.company_name,
          guestCount: b.guest_count,
          phone: b.phone,
          address: "Ristorante Storia",
          isPickup: false,
          status: b.status || "menu_pending",
          paymentStatus: b.payment_status,
          menuConfirmed: b.menu_confirmed,
          totalAmount: b.total_amount,
          navigateTo: b.source_inquiry_id
            ? `/admin/events/${b.source_inquiry_id}/edit`
            : `/admin/bookings`,
        });
      });

      inquiries.forEach((e: any) => {
        if (!e.preferred_date) return;
        const dStr = String(e.preferred_date).split("T")[0];
        if (dStr < todayStr || dStr > in7Str) return;
        // Only include confirmed events (others land in inbox)
        if (e.status !== "confirmed") return;
        const addr = [e.location_street, e.location_city].filter(Boolean).join(" ") || e.venue || e.location_name || null;
        operations.push({
          id: e.id,
          kind: "inquiry",
          date: dStr,
          time: e.time_slot ? String(e.time_slot).substring(0, 5) : null,
          customerName: e.contact_name,
          companyName: e.company_name,
          guestCount: e.guest_count ? Number(e.guest_count) : null,
          phone: e.phone,
          address: addr,
          isPickup: false,
          status: e.status,
          paymentStatus: null,
          menuConfirmed: null,
          totalAmount: e.total_amount,
          navigateTo: `/admin/events/${e.id}/edit`,
        });
      });

      operations.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || "99").localeCompare(b.time || "99");
      });

      // ── Inbox: last 48h ──
      const inbox: DashInbox[] = [];
      inquiries.forEach((e: any) => {
        const created = new Date(e.created_at);
        if (created < past48) return;
        if (e.status === "declined" || e.status === "confirmed") return;
        const hours = Math.max(0, Math.floor((today.getTime() + 24*3600_000 - created.getTime()) / 3600_000));
        const hoursSinceCreated = Math.max(0, Math.floor((Date.now() - created.getTime()) / 3600_000));
        inbox.push({
          id: e.id,
          kind: "inquiry",
          customerName: e.contact_name,
          subtitle: [e.event_type, e.guest_count ? `${e.guest_count} P.` : null].filter(Boolean).join(" · ") || null,
          createdAt: e.created_at,
          ageDays: diffDays(today, created),
          isStale: false,
          navigateTo: `/admin/events/${e.id}/edit`,
          unanswered: !repliedSet.has(e.id),
          hoursSince: hoursSinceCreated,
        });
      });
      cateringInbox.forEach((c: any) => {
        inbox.push({
          id: c.id,
          kind: "catering",
          customerName: c.customer_name,
          subtitle: c.company_name || c.order_number,
          createdAt: c.created_at,
          ageDays: diffDays(today, new Date(c.created_at)),
          isStale: false,
          navigateTo: `/admin/catering/${c.id}`,
        });
      });
      groups.forEach((g: any) => {
        inbox.push({
          id: g.id,
          kind: "group",
          customerName: g.v2_customers?.name || "—",
          subtitle: `Gruppe · ${g.guest_count ?? "?"} P.`,
          createdAt: g.created_at,
          ageDays: diffDays(today, new Date(g.created_at)),
          isStale: false,
          navigateTo: `/admin/inquiries/${g.id}/edit`,
        });
      });
      inbox.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // ── Stale: inquiries > 5d without offer ──
      const staleInquiries: DashInbox[] = [];
      inquiries.forEach((e: any) => {
        if (e.offer_sent_at || e.status === "declined" || e.status === "confirmed") return;
        const created = new Date(e.created_at);
        const age = diffDays(today, created);
        if (age < 5 || age > 30) return;
        staleInquiries.push({
          id: e.id,
          kind: "inquiry",
          customerName: e.contact_name,
          subtitle: e.event_type || null,
          createdAt: e.created_at,
          ageDays: age,
          isStale: true,
          navigateTo: `/admin/events/${e.id}/edit`,
        });
      });
      staleInquiries.sort((a, b) => b.ageDays - a.ageDays);

      // ── Overdue payments ──
      const overduePayments = payments
        .filter((p: any) => p.computed_status === "overdue")
        .map((p: any) => {
          const due = p.effective_due_date ? new Date(p.effective_due_date) : today;
          return {
            id: p.id,
            inquiryId: p.inquiry_id,
            customerName: p.customer_name || "—",
            amountCents: p.amount_cents,
            daysOverdue: Math.max(0, diffDays(today, due)),
          };
        });

      // ── Week stats & byDay ──
      const byDay: Record<string, { events: number; catering: number; guests: number; revenueCents: number }> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(today); d.setDate(d.getDate() + i);
        byDay[ymd(d)] = { events: 0, catering: 0, guests: 0, revenueCents: 0 };
      }
      operations.forEach(op => {
        const slot = byDay[op.date];
        if (!slot) return;
        if (op.kind === "catering") slot.catering += 1;
        else slot.events += 1;
        slot.guests += op.guestCount || 0;
        slot.revenueCents += Math.round((op.totalAmount || 0) * 100);
      });

      const weekKeys = Object.keys(byDay).slice(0, 7);
      const nextWeekKeys = Object.keys(byDay).slice(7, 14);
      const sumKeys = (keys: string[]) => keys.reduce(
        (acc, k) => {
          const s = byDay[k];
          acc.events += s.events; acc.catering += s.catering;
          acc.guests += s.guests; acc.revenue += s.revenueCents;
          return acc;
        },
        { events: 0, catering: 0, guests: 0, revenue: 0 }
      );
      const wk = sumKeys(weekKeys);
      const nw = sumKeys(nextWeekKeys);

      // Paid this week (from payments with event in week)
      const weekInquiryIds = new Set(
        operations.filter(o => weekKeys.includes(o.date) && o.kind === "inquiry").map(o => o.id)
      );
      const paidCents = payments
        .filter((p: any) => weekInquiryIds.has(p.inquiry_id) && p.computed_status === "paid")
        .reduce((s: number, p: any) => s + p.amount_cents, 0);

      // Risks next week: bookings with menu_confirmed=false
      const risks = bookings.filter((b: any) =>
        b.event_date && nextWeekKeys.includes(String(b.event_date).split("T")[0]) && b.menu_confirmed === false
      ).length;

      return {
        operations,
        inbox,
        staleInquiries,
        overduePayments,
        weekStats: {
          eventsCount: wk.events,
          cateringCount: wk.catering,
          guestsCount: wk.guests,
          revenueCents: wk.revenue,
          paidCents,
        },
        byDay,
        nextWeek: { count: nw.events + nw.catering, guests: nw.guests, risks },
      };
    },
  });
}