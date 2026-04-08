import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isToday, isTomorrow, differenceInDays, startOfDay, addDays, isBefore } from "date-fns";
import { de } from "date-fns/locale";

// ─── Safe date parsing ────────────────────────────────────────────────────────
function safeParse(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
import {
  Calendar, Users, Building2, AlertTriangle, Clock, ChevronDown,
  ChevronRight, Bell, Euro, TrendingUp, Inbox, ExternalLink
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  time_slot?: string;
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

interface OfferOption {
  inquiry_id: string;
  total_amount: number;
}

interface DayGroup {
  date: string;
  label: string;
  events: EventInquiry[];
  isPast: boolean;
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
  const d = safeParse(dateStr);
  if (!d) return dateStr;
  try {
    if (isToday(d)) return "Heute";
    if (isTomorrow(d)) return "Morgen";
    const diff = differenceInDays(d, startOfDay(new Date()));
    if (diff < 0) return format(d, "EEEE, dd. MMMM yyyy", { locale: de });
    if (diff < 7) return format(d, "EEEE, dd. MMMM", { locale: de });
    return format(d, "dd. MMMM yyyy", { locale: de });
  } catch {
    return dateStr;
  }
}

function formatEUR(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatEURDirect(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

// ─── AlarmBanner ─────────────────────────────────────────────────────────────

interface Alarm {
  type: "overdue_payment" | "stale_inquiry" | "unanswered_reply";
  label: string;
  inquiryId: string;
  contactName: string;
}

const AlarmBanner = ({ alarms, onNavigate }: { alarms: Alarm[]; onNavigate: (id: string) => void }) => {
  const [expanded, setExpanded] = useState(false);
  if (alarms.length === 0) return null;

  const visible = expanded ? alarms : alarms.slice(0, 3);
  const hiddenCount = alarms.length - 3;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-2">
        <Bell className="h-4 w-4" />
        {alarms.length} {alarms.length === 1 ? "Alarm" : "Alarme"}
      </div>
      {visible.map((a, i) => (
        <button
          key={i}
          onClick={() => onNavigate(a.inquiryId)}
          className="w-full text-left flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <span className={cn(
            "text-sm",
            a.type === "overdue_payment" ? "text-red-700" : "text-amber-900"
          )}>
            <strong>{a.contactName}</strong> — {a.label}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 ml-2" />
        </button>
      ))}
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-amber-700 hover:underline pl-3 pt-0.5"
        >
          und {hiddenCount} weitere Alarme anzeigen ▾
        </button>
      )}
      {expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-amber-700 hover:underline pl-3 pt-0.5"
        >
          Weniger anzeigen ▴
        </button>
      )}
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

  const barColor = hasOverdue
    ? "bg-red-500"
    : event.offer_phase === "customer_responded"
    ? "bg-teal-500"
    : event.status === "confirmed"
    ? "bg-green-600"
    : event.offer_sent_at
    ? "bg-emerald-400"
    : "bg-amber-400";

  // Time: prefer explicit time_slot field, fall back to time in preferred_date
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
      className="w-full text-left flex items-stretch bg-white border border-border/60 rounded-xl overflow-hidden hover:shadow-md hover:border-amber-200 transition-all duration-150 group"
    >
      {/* Color bar */}
      <div className={cn("w-1 flex-shrink-0", barColor)} />

      <div className="flex-1 px-4 py-3 min-w-0">
        <div className="flex items-start gap-3">
          {/* Zeit — groß links */}
          {timeStr && (
            <div className="flex-shrink-0 text-right min-w-[2.5rem]">
              <span className="text-xl font-bold text-foreground leading-none tracking-tight">{timeStr}</span>
              <span className="text-[10px] text-muted-foreground block leading-none mt-0.5">Uhr</span>
            </div>
          )}

          {/* Haupt-Inhalt */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate leading-tight">
                  {event.contact_name}
                </p>
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

            {/* Event-Typ + Gäste */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {event.event_type && (
                <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  {event.event_type}
                </span>
              )}
              {event.guest_count && (
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.guest_count} Gäste
                </span>
              )}
            </div>

            {/* Payment Pills */}
            {eventPayments.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {eventPayments.map((p) => (
                  <PaymentPill key={p.id} payment={p} />
                ))}
              </div>
            )}
          </div>
        </div>
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
  alwaysOpen,
}: {
  group: DayGroup;
  payments: EventPayment[];
  onNavigate: (id: string) => void;
  defaultOpen: boolean;
  alwaysOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen || alwaysOpen);

  const isToday_ = !group.isPast && group.date !== "__no_date__" && isToday(parseISO(group.date));
  const isTomorrow_ = !group.isPast && group.date !== "__no_date__" && isTomorrow(parseISO(group.date));
  const isSpecial = isToday_ || isTomorrow_ || group.date === "__no_date__";

  return (
    <div className={cn("space-y-2", group.isPast && "opacity-60")}>
      {/* Tagesheader */}
      <div className="flex items-center gap-3">
        {alwaysOpen ? (
          // Kein Toggle-Button bei Heute/Morgen/Termin offen
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-bold",
              isSpecial ? "text-base text-foreground" : "text-sm text-foreground",
            )}>
              {group.label}
            </span>
            {isToday_ && (
              <span className="text-xs font-semibold text-white bg-amber-600 px-2 py-0.5 rounded-full">
                Heute
              </span>
            )}
            {isTomorrow_ && (
              <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                Morgen
              </span>
            )}
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {group.events.length}
            </span>
          </div>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-left group"
          >
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-semibold text-sm text-foreground">{group.label}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {group.events.length}
            </span>
          </button>
        )}
        {/* Akzentlinie */}
        <div className={cn(
          "flex-1 h-px",
          isToday_ ? "bg-amber-400" : isTomorrow_ ? "bg-amber-200" : "bg-border/50"
        )} />
      </div>

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
  offerOptions,
  onNavigate,
}: {
  events: EventInquiry[];
  payments: EventPayment[];
  offerOptions: OfferOption[];
  onNavigate: (id: string) => void;
}) => {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);

  const thisWeekEvents = events.filter((e) => {
    if (!e.preferred_date) return false;
    const d = safeParse(e.preferred_date);
    return !!d && d >= today && d < weekEnd;
  });
  const thisWeekIds = new Set(thisWeekEvents.map((e) => e.id));

  const confirmedCount = events.filter((e) => e.status === "confirmed").length;
  const pendingOffer = events.filter(
    (e) => e.offer_sent_at && e.status !== "confirmed" && e.status !== "declined"
  ).length;
  const newCount = events.filter((e) => !e.offer_sent_at && !e.last_edited_at).length;

  // Wochenumsatz aus Offer-Options
  const weekRevenue = offerOptions
    .filter((o) => thisWeekIds.has(o.inquiry_id))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Gäste diese Woche
  const weekGuests = thisWeekEvents.reduce((sum, e) => sum + (e.guest_count || 0), 0);

  // Bezahlt vs. Offen (nach Betrag)
  const weekPayments = payments.filter((p) => thisWeekIds.has(p.inquiry_id));
  const paidCents = weekPayments
    .filter((p) => p.computed_status === "paid")
    .reduce((s, p) => s + p.amount_cents, 0);
  const openCents = weekPayments
    .filter((p) => p.computed_status !== "paid" && p.computed_status !== "cancelled")
    .reduce((s, p) => s + p.amount_cents, 0);
  const totalPaymentCents = paidCents + openCents;
  const paidPercent = totalPaymentCents > 0 ? Math.round((paidCents / totalPaymentCents) * 100) : 0;

  // Upcoming payments (due in next 14 days)
  const upcomingPayments = payments
    .filter((p) => {
      if (!p.effective_due_date) return false;
      if (p.computed_status === "paid" || p.computed_status === "cancelled") return false;
      const due = safeParse(p.effective_due_date);
      if (!due) return false;
      const diff = differenceInDays(due, today);
      return diff >= -3 && diff <= 14;
    })
    .sort((a, b) => {
      const da = safeParse(a.effective_due_date);
      const db = safeParse(b.effective_due_date);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    })
    .slice(0, 8);

  // Open inquiries without offer (> 48h)
  const openInquiries = events
    .filter((e) => {
      if (e.offer_sent_at || e.status === "declined") return false;
      const d = safeParse(e.created_at);
      if (!d) return false;
      return differenceInDays(today, d) >= 2;
    })
    .sort((a, b) => {
      const da = safeParse(a.created_at);
      const db = safeParse(b.created_at);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    })
    .slice(0, 6);

  return (
    <div className="space-y-4 w-72 flex-shrink-0">
      {/* Wochenübersicht */}
      <Card className="border-amber-200/60 bg-amber-50/30">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            Wochenübersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Umsatz */}
          {weekRevenue > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Umsatz Woche</span>
              <span className="font-bold text-amber-800">{formatEURDirect(weekRevenue)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Events diese Woche</span>
            <span className="font-bold text-foreground">{thisWeekEvents.length}</span>
          </div>

          {weekGuests > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gäste gesamt</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {weekGuests}
              </span>
            </div>
          )}

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

          {/* Bezahlt vs. Offen Fortschrittsbalken */}
          {totalPaymentCents > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Bezahlt</span>
                <span>{paidPercent}% · {formatEUR(paidCents)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Offen</span>
                <span>{formatEUR(openCents)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fälligkeiten */}
      {upcomingPayments.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              Fälligkeiten (14 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            {upcomingPayments.map((p) => {
              const due = safeParse(p.effective_due_date);
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

      {/* Offene Anfragen ohne Angebot (> 48h) */}
      {openInquiries.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              Warten auf Angebot
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            {openInquiries.map((e) => {
              const d = safeParse(e.created_at);
              const diff = d ? differenceInDays(today, d) : 0;
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
                  <span className={cn(
                    "text-xs flex-shrink-0 ml-2",
                    diff >= 4 ? "text-red-600 font-semibold" : "text-muted-foreground"
                  )}>
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
            .select("id, inquiry_id, payment_type, amount_cents, computed_status, effective_due_date, email_sent_at, contact_name, customer_email")
            .not("computed_status", "eq", "cancelled"),
          supabase
            .from("inquiry_offer_options" as never)
            .select("inquiry_id, total_amount")
            .eq("is_active", true),
        ]);

        if (eventsRes.error) console.error("[Dashboard] events:", eventsRes.error);
        if (paymentsRes.error) console.error("[Dashboard] payments:", paymentsRes.error);
        if (optionsRes.error) console.error("[Dashboard] offer_options:", optionsRes.error);

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

  // ── Alarms (Priorität: overdue → unanswered → stale ≥ 7 Tage) ─────────────
  const alarms = useMemo<Alarm[]>(() => {
    const result: Alarm[] = [];
    const today = startOfDay(new Date());

    // 1. Überfällige Zahlungen
    payments
      .filter((p) => p.computed_status === "overdue")
      .forEach((p) => {
        result.push({
          type: "overdue_payment",
          label: `Zahlung überfällig (${formatEUR(p.amount_cents)})`,
          inquiryId: p.inquiry_id,
          contactName: p.contact_name || "—",
        });
      });

    // 2. Kundenantworten ohne Aktion
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

    // 3. Stale Anfragen (≥ 7 Tage kein Angebot)
    events
      .filter((e) => {
        if (e.offer_sent_at || e.status === "declined") return false;
        const d = safeParse(e.created_at);
        if (!d) return false;
        return differenceInDays(today, d) >= 7;
      })
      .forEach((e) => {
        const d = safeParse(e.created_at);
        const diff = d ? differenceInDays(today, d) : 0;
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
    const today = startOfDay(new Date());
    const withoutDate: EventInquiry[] = [];
    const byDate: Record<string, EventInquiry[]> = {};

    events.forEach((e) => {
      if (!e.preferred_date) { withoutDate.push(e); return; }
      const key = e.preferred_date.split("T")[0];
      const d = safeParse(key);
      if (!d) { withoutDate.push(e); return; } // ungültiges Datum → Termin offen
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(e);
    });

    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evts]) => {
        const d = safeParse(date)!;
        return {
          date,
          label: formatDayLabel(date),
          events: evts,
          isPast: isBefore(d, today),
        };
      });

    if (withoutDate.length > 0) {
      sorted.push({
        date: "__no_date__",
        label: "Termin offen",
        events: withoutDate,
        isPast: false,
      });
    }

    return sorted;
  }, [events]);

  // Welche Gruppen immer offen / default offen --------------------------------
  const getGroupOpenState = (group: DayGroup): { defaultOpen: boolean; alwaysOpen: boolean } => {
    if (group.date === "__no_date__") return { defaultOpen: true, alwaysOpen: true };
    if (group.isPast) return { defaultOpen: false, alwaysOpen: false };
    const today = startOfDay(new Date());
    const d = safeParse(group.date);
    if (!d) return { defaultOpen: false, alwaysOpen: false };
    if (isToday(d) || isTomorrow(d)) return { defaultOpen: true, alwaysOpen: true };
    const diff = differenceInDays(d, today);
    return { defaultOpen: diff <= 7, alwaysOpen: false };
  };

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

        {/* Main layout */}
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
              groups.map((group) => {
                const { defaultOpen, alwaysOpen } = getGroupOpenState(group);
                return (
                  <TimelineGroup
                    key={group.date}
                    group={group}
                    payments={payments}
                    onNavigate={goToEvent}
                    defaultOpen={defaultOpen}
                    alwaysOpen={alwaysOpen}
                  />
                );
              })
            )}
          </div>

          {/* Sidebar */}
          {!loading && (
            <Sidebar
              events={events}
              payments={payments}
              offerOptions={offerOptions}
              onNavigate={goToEvent}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
