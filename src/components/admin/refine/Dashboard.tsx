import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow, differenceInDays, startOfDay, addDays } from "date-fns";
import { de } from "date-fns/locale";
import {
  Calendar, Users, Building2, AlertTriangle, Clock, ChevronDown,
  ChevronRight, Bell, Euro, TrendingUp, Inbox, ExternalLink
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventInquiry {
  id: string;
  contact_name: string;
  company_name?: string;
  event_type?: string;
  guest_count?: number;
  preferred_date?: string;
  status: string;
  offer_phase?: string;
  offer_sent_at?: string;
  last_edited_at?: string;
  created_at: string;
  archived_at?: string;
  assigned_to?: string;
}

interface EventPayment {
  id: string;
  inquiry_id: string;
  payment_type: "deposit" | "prepayment" | "final";
  amount_cents: number;
  computed_status: string;
  effective_due_date?: string;
  email_sent_at?: string;
  contact_name?: string;
  customer_email?: string;
}

interface DayGroup {
  date: string;
  label: string;
  events: EventInquiry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusBadge(e: EventInquiry) {
  if (e.offer_phase === "customer_responded") {
    return { label: "Antwort erhalten", cls: "border-teal-500/50 text-teal-700 bg-teal-50 ring-1 ring-teal-300" };
  }
  if (e.offer_sent_at && e.status !== "confirmed" && e.status !== "declined") {
    return { label: "Angebot gesendet", cls: "border-emerald-500/50 text-emerald-700 bg-emerald-50" };
  }
  if (e.last_edited_at && !e.offer_sent_at) {
    return { label: "In Bearbeitung", cls: "border-amber-500/50 text-amber-700 bg-amber-50" };
  }
  if (e.status === "confirmed") {
    return { label: "Bestätigt", cls: "border-green-600/50 text-green-700 bg-green-50" };
  }
  if (e.status === "declined") {
    return { label: "Abgelehnt", cls: "border-muted-foreground/50 text-muted-foreground bg-muted" };
  }
  return { label: "Neu", cls: "border-amber-500/50 text-amber-700 bg-amber-50" };
}

function formatDayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Heute";
  if (isTomorrow(d)) return "Morgen";
  const diff = differenceInDays(d, startOfDay(new Date()));
  if (diff < 0) return format(d, "EEEE, dd. MMMM yyyy", { locale: de });
  if (diff < 7) return format(d, "EEEE, dd. MMMM", { locale: de });
  return format(d, "dd. MMMM yyyy", { locale: de });
}

function formatEUR(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// ─── AlarmBanner ─────────────────────────────────────────────────────────────

interface Alarm {
  type: "overdue_payment" | "stale_inquiry" | "unanswered_reply";
  label: string;
  inquiryId: string;
  contactName: string;
}

const AlarmBanner = ({ alarms, onNavigate }: { alarms: Alarm[]; onNavigate: (id: string) => void }) => {
  if (alarms.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
        <AlertTriangle className="h-4 w-4" />
        {alarms.length} {alarms.length === 1 ? "Alarm" : "Alarme"} — sofort handeln
      </div>
      <div className="space-y-1">
        {alarms.map((a, i) => (
          <button
            key={i}
            onClick={() => onNavigate(a.inquiryId)}
            className="w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
          >
            <span className="text-sm text-red-800">
              <strong>{a.contactName}</strong> — {a.label}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── PaymentPill ─────────────────────────────────────────────────────────────

const PaymentPill = ({ payment }: { payment: EventPayment }) => {
  const typeLabel: Record<string, string> = { deposit: "Anz", prepayment: "Vor", final: "End" };
  const statusColor: Record<string, string> = {
    overdue: "bg-red-100 text-red-700 border-red-200",
    sent: "bg-amber-100 text-amber-700 border-amber-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    draft: "bg-gray-100 text-gray-500 border-gray-200",
  };
  const cls = statusColor[payment.computed_status] || statusColor.draft;
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", cls)}>
      {typeLabel[payment.payment_type] || payment.payment_type} {formatEUR(payment.amount_cents)}
      {payment.computed_status === "overdue" && " ⚠️"}
    </span>
  );
};

// ─── EventCard ────────────────────────────────────────────────────────────────

const EventCard = ({
  event,
  payments,
  onClick,
}: {
  event: EventInquiry;
  payments: EventPayment[];
  onClick: () => void;
}) => {
  const { label, cls } = getStatusBadge(event);
  const eventPayments = payments.filter((p) => p.inquiry_id === event.id);
  const hasOverdue = eventPayments.some((p) => p.computed_status === "overdue");
  const isConfirmed = event.status === "confirmed";

  const barColor = hasOverdue
    ? "bg-red-500"
    : event.offer_phase === "customer_responded"
    ? "bg-teal-500"
    : isConfirmed
    ? "bg-green-600"
    : event.offer_sent_at
    ? "bg-emerald-400"
    : "bg-amber-400";

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-stretch bg-white border border-border/60 rounded-xl overflow-hidden hover:shadow-md hover:border-border transition-all duration-150 group"
    >
      {/* Color bar */}
      <div className={cn("w-1 flex-shrink-0", barColor)} />

      <div className="flex-1 px-4 py-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{event.contact_name}</p>
            {event.company_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                {event.company_name}
              </p>
            )}
          </div>
          <Badge variant="outline" className={cn("text-xs font-medium flex-shrink-0", cls)}>
            {label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {event.event_type && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {event.event_type}
            </span>
          )}
          {event.guest_count && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.guest_count}
            </span>
          )}
          {event.preferred_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(event.preferred_date), "dd.MM.yy", { locale: de })}
            </span>
          )}
        </div>

        {eventPayments.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {eventPayments.map((p) => (
              <PaymentPill key={p.id} payment={p} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
};

// ─── TimelineGroup ────────────────────────────────────────────────────────────

const TimelineGroup = ({
  group,
  payments,
  onNavigate,
  defaultOpen,
}: {
  group: DayGroup;
  payments: EventPayment[];
  onNavigate: (id: string) => void;
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 text-left group"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm text-foreground">{group.label}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {group.events.length}
          </span>
        </div>
        <div className="flex-1 h-px bg-border/50" />
      </button>

      {open && (
        <div className="space-y-2 pl-4">
          {group.events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              payments={payments}
              onClick={() => onNavigate(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = ({
  events,
  payments,
  onNavigate,
}: {
  events: EventInquiry[];
  payments: EventPayment[];
  onNavigate: (id: string) => void;
}) => {
  // Week stats
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);
  const thisWeekEvents = events.filter((e) => {
    if (!e.preferred_date) return false;
    const d = parseISO(e.preferred_date);
    return d >= today && d < weekEnd;
  });
  const confirmedCount = events.filter((e) => e.status === "confirmed").length;
  const pendingOffer = events.filter((e) => e.offer_sent_at && e.status !== "confirmed" && e.status !== "declined").length;
  const newCount = events.filter((e) => !e.offer_sent_at && !e.last_edited_at).length;

  // Upcoming payments (due in next 14 days)
  const upcomingPayments = payments
    .filter((p) => {
      if (!p.effective_due_date) return false;
      if (p.computed_status === "paid" || p.computed_status === "cancelled") return false;
      const due = parseISO(p.effective_due_date);
      const diff = differenceInDays(due, today);
      return diff >= -3 && diff <= 14;
    })
    .sort((a, b) => {
      if (!a.effective_due_date || !b.effective_due_date) return 0;
      return parseISO(a.effective_due_date).getTime() - parseISO(b.effective_due_date).getTime();
    })
    .slice(0, 8);

  // Open inquiries (no offer sent, created > 24h ago)
  const openInquiries = events
    .filter((e) => {
      if (e.offer_sent_at || e.status === "declined") return false;
      const diff = differenceInDays(today, parseISO(e.created_at));
      return diff >= 1;
    })
    .sort((a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4 w-72 flex-shrink-0">
      {/* Wochenübersicht */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Wochenübersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Events diese Woche</span>
            <span className="font-bold text-foreground">{thisWeekEvents.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Bestätigt</span>
            <span className="font-semibold text-green-700">{confirmedCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Angebot ausstehend</span>
            <span className="font-semibold text-amber-700">{pendingOffer}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Neue Anfragen</span>
            <span className="font-semibold text-foreground">{newCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Fälligkeiten */}
      {upcomingPayments.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              Fälligkeiten (14 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {upcomingPayments.map((p) => {
              const due = p.effective_due_date ? parseISO(p.effective_due_date) : null;
              const diff = due ? differenceInDays(due, today) : null;
              const isOverdue = p.computed_status === "overdue";
              return (
                <button
                  key={p.id}
                  onClick={() => onNavigate(p.inquiry_id)}
                  className="w-full text-left flex items-center justify-between hover:bg-muted/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.contact_name || "—"}</p>
                    <p className={cn("text-xs", isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                      {isOverdue
                        ? `Überfällig seit ${diff !== null ? Math.abs(diff) : "?"} T.`
                        : due
                        ? diff === 0
                          ? "Heute fällig"
                          : diff === 1
                          ? "Morgen fällig"
                          : `In ${diff} Tagen`
                        : "—"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-foreground ml-2 flex-shrink-0">
                    {formatEUR(p.amount_cents)}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Offene Anfragen ohne Angebot */}
      {openInquiries.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              Warten auf Angebot
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {openInquiries.map((e) => {
              const diff = differenceInDays(today, parseISO(e.created_at));
              return (
                <button
                  key={e.id}
                  onClick={() => onNavigate(e.id)}
                  className="w-full text-left flex items-center justify-between hover:bg-muted/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{e.contact_name}</p>
                    {e.event_type && (
                      <p className="text-xs text-muted-foreground truncate">{e.event_type}</p>
                    )}
                  </div>
                  <span className={cn("text-xs flex-shrink-0 ml-2", diff >= 3 ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                    {diff}T offen
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventInquiry[]>([]);
  const [payments, setPayments] = useState<EventPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventsRes, paymentsRes] = await Promise.all([
          supabase
            .from("event_inquiries")
            .select("*")
            .in("status", ["new", "contacted", "offer_sent", "confirmed", "declined"])
            .is("archived_at", null)
            .order("preferred_date", { ascending: true, nullsFirst: false }),
          supabase
            .from("event_payments_enriched" as never)
            .select("id, inquiry_id, payment_type, amount_cents, computed_status, effective_due_date, email_sent_at, contact_name, customer_email")
            .not("computed_status", "eq", "cancelled"),
        ]);
        if (eventsRes.error) console.error("[Dashboard] events query error:", eventsRes.error);
        if (paymentsRes.error) console.error("[Dashboard] payments query error:", paymentsRes.error);
        if (eventsRes.data) setEvents(eventsRes.data as unknown as EventInquiry[]);
        if (paymentsRes.data) setPayments(paymentsRes.data as EventPayment[]);
      } catch (err) {
        console.error("[Dashboard] load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const goToEvent = (id: string) => navigate(`/admin/events/${id}/edit`);

  // ── Alarms ────────────────────────────────────────────────────────────────
  const alarms = useMemo<Alarm[]>(() => {
    const result: Alarm[] = [];
    const today = startOfDay(new Date());

    // Overdue payments
    const overduePayments = payments.filter((p) => p.computed_status === "overdue");
    overduePayments.forEach((p) => {
      result.push({
        type: "overdue_payment",
        label: `Zahlung überfällig (${formatEUR(p.amount_cents)})`,
        inquiryId: p.inquiry_id,
        contactName: p.contact_name || "—",
      });
    });

    // Customer replied but no action (offer_phase = customer_responded)
    events
      .filter((e) => e.offer_phase === "customer_responded")
      .forEach((e) => {
        result.push({
          type: "unanswered_reply",
          label: "Hat auf Angebot geantwortet — Aktion ausstehend",
          inquiryId: e.id,
          contactName: e.contact_name,
        });
      });

    // Stale inquiries (> 5 days, no offer)
    events
      .filter((e) => {
        if (e.offer_sent_at || e.status === "declined") return false;
        const diff = differenceInDays(today, parseISO(e.created_at));
        return diff >= 5;
      })
      .forEach((e) => {
        const diff = differenceInDays(today, parseISO(e.created_at));
        result.push({
          type: "stale_inquiry",
          label: `Kein Angebot seit ${diff} Tagen`,
          inquiryId: e.id,
          contactName: e.contact_name,
        });
      });

    return result;
  }, [events, payments]);

  // ── Timeline groups ────────────────────────────────────────────────────────
  const groups = useMemo<DayGroup[]>(() => {
    const withDate = events.filter((e) => e.preferred_date);
    const withoutDate = events.filter((e) => !e.preferred_date);

    const byDate: Record<string, EventInquiry[]> = {};
    withDate.forEach((e) => {
      const key = e.preferred_date!.split("T")[0];
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(e);
    });

    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evts]) => ({
        date,
        label: formatDayLabel(date),
        events: evts,
      }));

    if (withoutDate.length > 0) {
      sorted.push({
        date: "__no_date__",
        label: "Termin offen",
        events: withoutDate,
      });
    }

    return sorted;
  }, [events]);

  // Auto-open today's and tomorrow's groups (+ first group if past)
  const autoOpenDates = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const todayStr = format(today, "yyyy-MM-dd");
    const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
    const set = new Set([todayStr, tomorrowStr, "__no_date__"]);
    // also open the first group with future dates
    const firstFuture = groups.find((g) => {
      if (g.date === "__no_date__") return false;
      return parseISO(g.date) >= today;
    });
    if (firstFuture) set.add(firstFuture.date);
    return set;
  }, [groups]);

  return (
    <AdminLayout activeTab="dashboard" title="Dashboard" showCreateButton={true} createButtonText="Neue Anfrage">
      <div className="space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations-Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {events.length} aktive Anfragen · {payments.filter((p) => p.computed_status === "overdue").length} überfällige Zahlungen
          </p>
        </div>

        {/* AlarmBanner */}
        {!loading && <AlarmBanner alarms={alarms} onNavigate={goToEvent} />}

        {/* Main layout: timeline + sidebar */}
        <div className="flex gap-6 items-start">
          {/* Timeline */}
          <div className="flex-1 min-w-0 space-y-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Keine aktiven Anfragen</p>
              </div>
            ) : (
              groups.map((group) => (
                <TimelineGroup
                  key={group.date}
                  group={group}
                  payments={payments}
                  onNavigate={goToEvent}
                  defaultOpen={autoOpenDates.has(group.date)}
                />
              ))
            )}
          </div>

          {/* Sidebar */}
          {!loading && (
            <Sidebar events={events} payments={payments} onNavigate={goToEvent} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
