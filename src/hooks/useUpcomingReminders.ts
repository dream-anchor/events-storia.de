import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTestMode } from "@/contexts/TestModeContext";

export interface UpcomingReminder {
  id: string;
  scheduledAt: Date; // when the cron will pick it up
  scheduledLabel: string;
  kind:
    | "follow_up_task"
    | "catering_kitchen"
    | "catering_customer_reminder"
    | "payment_overdue"
    | "offer_reminder";
  title: string;
  recipient: string | null;
  navigateTo: string | null;
}

export interface SentReminder {
  id: string;
  sentAt: string;
  recipient: string;
  subject: string;
  status: string;
}

function nextDailyAt(hour: number, minute = 0): Date {
  const d = new Date();
  const target = new Date(d);
  target.setHours(hour, minute, 0, 0);
  if (target <= d) target.setDate(target.getDate() + 1);
  return target;
}

function nextHourly(): Date {
  const d = new Date();
  const target = new Date(d);
  target.setHours(d.getHours() + 1, 0, 0, 0);
  return target;
}

function fmtTime(d: Date): string {
  return d.toLocaleString("de-DE", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useUpcomingReminders() {
  const { showTestData } = useTestMode();
  return useQuery<{ upcoming: UpcomingReminder[]; recent: SentReminder[] }>({
    queryKey: ["upcoming-reminders", showTestData],
    refetchInterval: 60_000,
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const in48 = new Date(today); in48.setDate(in48.getDate() + 2);
      const past7 = new Date(today); past7.setDate(past7.getDate() - 7);

      // Inquiry tasks due in next 24-36h (cron runs daily 08:00)
      const taskQ = supabase
        .from("inquiry_tasks" as never)
        .select("id, title, due_date, inquiry_id, reminder_sent, status, event_inquiries!inner(archived_at, status)")
        .eq("reminder_sent", false)
        .neq("status", "completed")
        .is("event_inquiries.archived_at", null)
        .not("event_inquiries.status", "in", "(declined,confirmed,cancelled)")
        .lte("due_date", in48.toISOString())
        .order("due_date", { ascending: true });

      // Catering orders 2 days out (kitchen reminder, cron hourly)
      const in2 = new Date(today); in2.setDate(in2.getDate() + 2);
      const in2Str = `${in2.getFullYear()}-${String(in2.getMonth() + 1).padStart(2, "0")}-${String(in2.getDate()).padStart(2, "0")}`;
      let catQ = supabase
        .from("catering_orders")
        .select("id, customer_name, desired_date, desired_time, status, reminder_sent_at, is_test")
        .eq("desired_date", in2Str)
        .is("reminder_sent_at", null)
        .in("status", ["confirmed", "pending"])
        .is("cancelled_at", null);
      if (!showTestData) catQ = catQ.neq("is_test", true);

      // Payments becoming overdue (cron 09:00 daily)
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const payQ = supabase
        .from("event_payments_enriched" as never)
        .select("id, inquiry_id, customer_name, amount_cents, computed_status, effective_due_date, event_inquiries!inner(archived_at, status)")
        .eq("computed_status", "sent")
        .is("event_inquiries.archived_at", null)
        .not("event_inquiries.status", "in", "(declined,cancelled)")
        .lte("effective_due_date", todayStr);

      // Offer reminders: offer_sent 3+ days ago, no response
      const threeDaysAgo = new Date(today); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      let offerQ = supabase
        .from("event_inquiries" as never)
        .select("id, contact_name, email, offer_sent_at, status, reminder_count, is_test")
        .not("offer_sent_at", "is", null)
        .is("archived_at", null)
        .not("status", "in", "(declined,confirmed,cancelled)")
        .lte("offer_sent_at", threeDaysAgo.toISOString())
        .in("status", ["offer_sent", "contacted"])
        .or("reminder_count.is.null,reminder_count.lt.2");
      if (!showTestData) offerQ = offerQ.neq("is_test", true);

      // Recent sent reminders (last 7d)
      const sentQ = supabase
        .from("email_delivery_logs" as never)
        .select("id, sent_at, recipient_email, subject, status, metadata")
        .gte("sent_at", past7.toISOString())
        .ilike("subject", "%erinnerung%")
        .order("sent_at", { ascending: false })
        .limit(15);

      const [taskRes, catRes, payRes, offerRes, sentRes] = await Promise.all([
        taskQ, catQ, payQ, offerQ, sentQ,
      ]);

      const upcoming: UpcomingReminder[] = [];

      const followUpCron = nextDailyAt(8);
      ((taskRes.data || []) as any[]).forEach(t => {
        upcoming.push({
          id: `task-${t.id}`,
          scheduledAt: followUpCron,
          scheduledLabel: fmtTime(followUpCron),
          kind: "follow_up_task",
          title: `Follow-up: ${t.title || "Aufgabe"}`,
          recipient: "Team",
          navigateTo: t.inquiry_id ? `/admin/events/${t.inquiry_id}/edit` : null,
        });
      });

      const hourlyCron = nextHourly();
      ((catRes.data || []) as any[]).forEach(c => {
        upcoming.push({
          id: `cat-${c.id}`,
          scheduledAt: hourlyCron,
          scheduledLabel: fmtTime(hourlyCron),
          kind: "catering_customer_reminder",
          title: `Liefererinnerung an ${c.customer_name}`,
          recipient: c.customer_name,
          navigateTo: `/admin/catering/${c.id}`,
        });
      });

      const overdueCron = nextDailyAt(9);
      ((payRes.data || []) as any[]).forEach(p => {
        upcoming.push({
          id: `pay-${p.id}`,
          scheduledAt: overdueCron,
          scheduledLabel: fmtTime(overdueCron),
          kind: "payment_overdue",
          title: `Zahlung wird überfällig: ${p.customer_name || "—"}`,
          recipient: p.customer_name,
          navigateTo: p.inquiry_id ? `/admin/events/${p.inquiry_id}/edit` : null,
        });
      });

      const offerCron = nextDailyAt(10);
      ((offerRes.data || []) as any[]).forEach(o => {
        upcoming.push({
          id: `offer-${o.id}`,
          scheduledAt: offerCron,
          scheduledLabel: fmtTime(offerCron),
          kind: "offer_reminder",
          title: `Angebotserinnerung an ${o.contact_name}`,
          recipient: o.email,
          navigateTo: `/admin/events/${o.id}/edit`,
        });
      });

      upcoming.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

      const recent: SentReminder[] = ((sentRes.data || []) as any[]).map(r => ({
        id: r.id,
        sentAt: r.sent_at,
        recipient: r.recipient_email,
        subject: r.subject,
        status: r.status,
      }));

      return { upcoming, recent };
    },
  });
}