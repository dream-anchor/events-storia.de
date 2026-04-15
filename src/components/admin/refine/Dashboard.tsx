import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow, differenceInDays, startOfDay, addDays, isBefore, isAfter } from "date-fns";
import { de } from "date-fns/locale";
import { formatDateRangeDE } from "@/lib/utils";
import {
  Calendar, Users, Building2, ChevronDown, ChevronRight, Euro,
  Inbox, Plus, AlertCircle, Clock, Check, ArrowRight
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Safe date parsing ────────────────────────────────────────────────────────
function safeParse(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventInquiry {
  id: string;
  contact_name: string;
  company_name?: string;
  event_type?: string;
  guest_count?: number;
  preferred_date?: string;
  event_end_date?: string;
  time_slot?: string;
  status: string;
  offer_phase?: string;
  offer_sent_at?: string;
  last_edited_at?: string;
  created_at: string;
  archived_at?: string;
}

interface EventPayment {
  id: string;
  inquiry_id: string;
  payment_type: "deposit" | "prepayment" | "final";
  amount_cents: number;
  computed_status: string;
  effective_due_date?: string;
  contact_name?: string;
}

interface OfferOption {
  inquiry_id: string;
  total_amount: number;
}

interface DayGroup {
  date: string;
  label: string;
  events: EventInquiry[];
  isToday: boolean;
  isTomorrow: boolean;
  isPast: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEUR(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function getPaymentColor(status: string) {
  if (status === "overdue") return "text-red-600 bg-red-50";
  if (status === "paid") return "text-emerald-700 bg-emerald-50";
  if (status === "sent") return "text-amber-700 bg-amber-50";
  return "text-neutral-500 bg-neutral-100";
}

function getBarColor(event: EventInquiry, payments: EventPayment[]) {
  const ep = payments.filter(p => p.inquiry_id === event.id);
  if (ep.some(p => p.computed_status === "overdue")) return "bg-red-500";
  if (event.status === "confirmed") return "bg-emerald-500";
  if (event.offer_sent_at) return "bg-neutral-300";
  return "bg-amber-400";
}

// ─── Urgent Strip ─────────────────────────────────────────────────────────────

const UrgentStrip = ({ overdueCount, overdueAmount, staleCount, onNavigate, payments }: {
  overdueCount: number;
  overdueAmount: number;
  staleCount: number;
  onNavigate: (id: string) => void;
  payments: EventPayment[];
}) => {
  const [expanded, setExpanded] = useState(false);

  if (overdueCount === 0 && staleCount === 0) return null;

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-left"
      >
        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 flex-1">
          {overdueCount > 0 && <span className="font-semibold">{overdueCount} überfällige Zahlung{overdueCount > 1 ? "en" : ""}</span>}
          {overdueCount > 0 && staleCount > 0 && " · "}
          {staleCount > 0 && <span>{staleCount} Anfrage{staleCount > 1 ? "n" : ""} ohne Angebot</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-red-400 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="pl-4 space-y-1">
          {payments
            .filter(p => p.computed_status === "overdue")
            .slice(0, 5)
            .map(p => (
              <button
                key={p.id}
                onClick={() => onNavigate(p.inquiry_id)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-neutral-100 text-sm transition-colors"
              >
                <span className="text-red-700 font-medium">{p.contact_name || "—"}</span>
                <span className="text-red-600 text-xs">{formatEUR(p.amount_cents)}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

// ─── Event Card (Clean) ───────────────────────────────────────────────────────

const EventCard = ({ event, payments, onClick }: {
  event: EventInquiry;
  payments: EventPayment[];
  onClick: () => void;
}) => {
  const eventPayments = payments.filter(p => p.inquiry_id === event.id);
  const barColor = getBarColor(event, payments);

  const timeStr = (() => {
    try {
      if (event.time_slot) return event.time_slot.substring(0, 5);
      if (event.preferred_date?.includes("T")) {
        const d = safeParse(event.preferred_date);
        return d ? format(d, "HH:mm") : null;
      }
      return null;
    } catch { return null; }
  })();

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-stretch bg-white rounded-xl border border-neutral-200/80 overflow-hidden hover:border-neutral-300 hover:shadow-sm transition-all active:scale-[0.99] group"
    >
      <div className={cn("w-1 flex-shrink-0 rounded-l-xl", barColor)} />
      <div className="flex-1 px-4 py-3 min-w-0">
        <div className="flex items-start gap-3">
          {/* Time */}
          {timeStr && (
            <div className="flex-shrink-0 pt-0.5">
              <span className="text-lg font-bold text-neutral-900 tabular-nums">{timeStr}</span>
            </div>
          )}
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-neutral-900 truncate">{event.contact_name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {event.company_name && (
                <span className="text-xs text-neutral-500 truncate">{event.company_name}</span>
              )}
              {event.guest_count && (
                <span className="text-xs text-neutral-500 flex items-center gap-0.5">
                  <Users className="h-3 w-3" />{event.guest_count}
                </span>
              )}
              {event.event_type && (
                <span className="text-xs text-neutral-400">{event.event_type}</span>
              )}
            </div>
            {/* Payments inline */}
            {eventPayments.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {eventPayments.map(p => (
                  <span key={p.id} className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getPaymentColor(p.computed_status))}>
                    {formatEUR(p.amount_cents)}
                    {p.computed_status === "overdue" && " überfällig"}
                    {p.computed_status === "paid" && " bezahlt"}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Arrow */}
          <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-400 flex-shrink-0 mt-1 transition-colors" />
        </div>
      </div>
    </button>
  );
};

// ─── Day Section ──────────────────────────────────────────────────────────────

const DaySection = ({ group, payments, onNavigate }: {
  group: DayGroup;
  payments: EventPayment[];
  onNavigate: (id: string) => void;
}) => {
  const alwaysOpen = group.isToday || group.isTomorrow;
  const [open, setOpen] = useState(alwaysOpen);

  return (
    <div className={cn(group.isPast && "opacity-40")}>
      {/* Day header */}
      <div className="flex items-center gap-2 mb-2">
        {alwaysOpen ? (
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-neutral-900">{group.label}</h3>
            {group.isToday && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-neutral-900 px-2 py-0.5 rounded-full">
                Heute
              </span>
            )}
            {group.isTomorrow && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                Morgen
              </span>
            )}
          </div>
        ) : (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 group">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
            <h3 className="text-sm font-medium text-neutral-600 group-hover:text-neutral-900 transition-colors">{group.label}</h3>
            <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{group.events.length}</span>
          </button>
        )}
        <div className="flex-1 h-px bg-neutral-100" />
      </div>

      {/* Events */}
      {(open || alwaysOpen) && (
        <div className="space-y-2 ml-1">
          {group.events.length === 0 && alwaysOpen && (
            <p className="text-sm text-neutral-400 py-4 text-center">Keine Events</p>
          )}
          {group.events.map(e => (
            <EventCard key={e.id} event={e} payments={payments} onClick={() => onNavigate(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Quick Stats ──────────────────────────────────────────────────────────────

const QuickStats = ({ thisWeekCount, thisWeekGuests, paidPercent, paidAmount, totalAmount }: {
  thisWeekCount: number;
  thisWeekGuests: number;
  paidPercent: number;
  paidAmount: number;
  totalAmount: number;
}) => (
  <div className="grid grid-cols-3 gap-3">
    <div className="bg-neutral-50 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold text-neutral-900">{thisWeekCount}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">Events diese Woche</p>
    </div>
    <div className="bg-neutral-50 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold text-neutral-900">{thisWeekGuests}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">Gäste</p>
    </div>
    <div className="bg-neutral-50 rounded-xl p-3 text-center">
      <p className="text-2xl font-bold text-neutral-900">{paidPercent}%</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">bezahlt</p>
      {totalAmount > 0 && (
        <div className="mt-1.5 h-1 bg-neutral-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paidPercent}%` }} />
        </div>
      )}
    </div>
  </div>
);

// ─── Open Inquiries (capped at 14 days) ──────────────────────────────────────

const OpenInquiries = ({ events, onNavigate }: { events: EventInquiry[]; onNavigate: (id: string) => void }) => {
  const today = startOfDay(new Date());
  const items = events
    .filter(e => {
      if (e.offer_sent_at || e.status === "declined" || e.status === "confirmed") return false;
      const d = safeParse(e.created_at);
      if (!d) return false;
      const age = differenceInDays(today, d);
      return age >= 2 && age <= 21; // 2-21 Tage — danach ist es ein toter Lead
    })
    .sort((a, b) => {
      const da = safeParse(a.created_at);
      const db = safeParse(b.created_at);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    })
    .slice(0, 5);

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4 text-neutral-400" />
        <h3 className="text-sm font-semibold text-neutral-700">Warten auf Angebot</h3>
      </div>
      <div className="space-y-1">
        {items.map(e => {
          const d = safeParse(e.created_at);
          const age = d ? differenceInDays(today, d) : 0;
          return (
            <button
              key={e.id}
              onClick={() => onNavigate(e.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 -mx-2 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800 truncate">{e.contact_name}</p>
                {e.event_type && <p className="text-xs text-neutral-400">{e.event_type}</p>}
              </div>
              <span className={cn(
                "text-xs font-medium flex-shrink-0 ml-3",
                age >= 7 ? "text-red-500" : "text-amber-500"
              )}>
                {age}T
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventInquiry[]>([]);
  const [payments, setPayments] = useState<EventPayment[]>([]);
  const [offerOptions, setOfferOptions] = useState<OfferOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventsRes, paymentsRes, optionsRes] = await Promise.all([
          supabase
            .from("event_inquiries")
            .select("*")
            .in("status", ["new", "contacted", "offer_sent", "confirmed", "declined"])
            .is("archived_at", null)
            .order("preferred_date", { ascending: true, nullsFirst: false }),
          supabase
            .from("event_payments_enriched" as never)
            .select("id, inquiry_id, payment_type, amount_cents, computed_status, effective_due_date, contact_name")
            .not("computed_status", "eq", "cancelled"),
          supabase
            .from("inquiry_offer_options" as never)
            .select("inquiry_id, total_amount")
            .eq("is_active", true),
        ]);

        if (eventsRes.data) setEvents(eventsRes.data as unknown as EventInquiry[]);
        if (paymentsRes.data) setPayments(paymentsRes.data as EventPayment[]);
        if (optionsRes.data) setOfferOptions(optionsRes.data as OfferOption[]);
      } catch (err) {
        console.error("[Dashboard] load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const goToEvent = (id: string) => navigate(`/admin/events/${id}/edit`);

  // ── Timeline groups (only future + today, max 30 days ahead) ───────────────
  const groups = useMemo<DayGroup[]>(() => {
    const today = startOfDay(new Date());
    const cutoff = addDays(today, 30);
    const withoutDate: EventInquiry[] = [];
    const byDate: Record<string, EventInquiry[]> = {};

    events.forEach(e => {
      if (!e.preferred_date) { withoutDate.push(e); return; }
      const key = e.preferred_date.split("T")[0];
      const d = safeParse(key);
      if (!d) { withoutDate.push(e); return; }
      // Only show today onward, max 30 days ahead
      if (isBefore(d, today) || isAfter(d, cutoff)) return;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(e);
    });

    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evts]) => {
        const d = safeParse(date)!;
        const isT = isToday(d);
        const isTm = isTomorrow(d);
        let label: string;
        try {
          if (isT) label = format(d, "EEEE, d. MMMM", { locale: de });
          else if (isTm) label = format(d, "EEEE, d. MMMM", { locale: de });
          else if (differenceInDays(d, today) < 7) label = format(d, "EEEE, d. MMMM", { locale: de });
          else label = format(d, "d. MMMM yyyy", { locale: de });
        } catch { label = date; }
        return { date, label, events: evts, isToday: isT, isTomorrow: isTm, isPast: false };
      });

    // Ensure Today and Tomorrow always exist
    const todayKey = format(today, "yyyy-MM-dd");
    const tomorrowKey = format(addDays(today, 1), "yyyy-MM-dd");
    if (!sorted.find(g => g.date === todayKey)) {
      sorted.unshift({
        date: todayKey,
        label: format(today, "EEEE, d. MMMM", { locale: de }),
        events: [],
        isToday: true,
        isTomorrow: false,
        isPast: false,
      });
    }
    if (!sorted.find(g => g.date === tomorrowKey)) {
      const tm = addDays(today, 1);
      sorted.splice(1, 0, {
        date: tomorrowKey,
        label: format(tm, "EEEE, d. MMMM", { locale: de }),
        events: [],
        isToday: false,
        isTomorrow: true,
        isPast: false,
      });
    }

    // Add "Termin offen" if any
    if (withoutDate.length > 0) {
      sorted.push({
        date: "__no_date__",
        label: "Termin offen",
        events: withoutDate,
        isToday: false,
        isTomorrow: false,
        isPast: false,
      });
    }

    return sorted;
  }, [events]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);

    const thisWeekEvents = events.filter(e => {
      const d = safeParse(e.preferred_date);
      return !!d && d >= today && d < weekEnd;
    });
    const thisWeekIds = new Set(thisWeekEvents.map(e => e.id));
    const weekGuests = thisWeekEvents.reduce((s, e) => s + (e.guest_count || 0), 0);

    const weekPayments = payments.filter(p => thisWeekIds.has(p.inquiry_id));
    const paidCents = weekPayments.filter(p => p.computed_status === "paid").reduce((s, p) => s + p.amount_cents, 0);
    const totalCents = weekPayments.filter(p => p.computed_status !== "cancelled").reduce((s, p) => s + p.amount_cents, 0);
    const paidPercent = totalCents > 0 ? Math.round((paidCents / totalCents) * 100) : 0;

    const overduePayments = payments.filter(p => p.computed_status === "overdue");
    const overdueAmount = overduePayments.reduce((s, p) => s + p.amount_cents, 0);

    const staleInquiries = events.filter(e => {
      if (e.offer_sent_at || e.status === "declined" || e.status === "confirmed") return false;
      const d = safeParse(e.created_at);
      return !!d && differenceInDays(today, d) >= 7;
    });

    return {
      thisWeekCount: thisWeekEvents.length,
      weekGuests,
      paidPercent,
      paidAmount: paidCents,
      totalAmount: totalCents,
      overdueCount: overduePayments.length,
      overdueAmount,
      staleCount: staleInquiries.length,
    };
  }, [events, payments]);

  return (
    <AdminLayout activeTab="dashboard" title="Maestro" showCreateButton={true} createButtonText="Neue Anfrage">
      {loading ? (
        <div className="space-y-4 max-w-3xl">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start max-w-5xl">
          {/* Main timeline */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Urgent strip */}
            <UrgentStrip
              overdueCount={stats.overdueCount}
              overdueAmount={stats.overdueAmount}
              staleCount={stats.staleCount}
              onNavigate={goToEvent}
              payments={payments}
            />

            {/* Quick stats — mobile only (desktop shows in sidebar) */}
            <div className="lg:hidden">
              <QuickStats
                thisWeekCount={stats.thisWeekCount}
                thisWeekGuests={stats.weekGuests}
                paidPercent={stats.paidPercent}
                paidAmount={stats.paidAmount}
                totalAmount={stats.totalAmount}
              />
            </div>

            {/* Timeline */}
            <div className="space-y-6">
              {groups.map(group => (
                <DaySection
                  key={group.date}
                  group={group}
                  payments={payments}
                  onNavigate={goToEvent}
                />
              ))}
            </div>
          </div>

          {/* Sidebar — desktop only */}
          <div className="hidden lg:block w-64 flex-shrink-0 space-y-4 sticky top-20">
            <QuickStats
              thisWeekCount={stats.thisWeekCount}
              thisWeekGuests={stats.weekGuests}
              paidPercent={stats.paidPercent}
              paidAmount={stats.paidAmount}
              totalAmount={stats.totalAmount}
            />
            <OpenInquiries events={events} onNavigate={goToEvent} />
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
