import { useState, useEffect, useMemo } from "react";
import { Calendar, Inbox as InboxIcon, Send, BarChart3 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getAdminFirstName } from "@/lib/adminDisplayNames";
import { TodayOperationsColumn } from "./dashboard/TodayOperationsColumn";
import { InboxColumn } from "./dashboard/InboxColumn";
import { OutboxColumn } from "./dashboard/OutboxColumn";
import { WeekHeatmap } from "./dashboard/WeekHeatmap";
import { NextUpHero } from "./dashboard/NextUpHero";

type MobileTab = "today" | "inbox" | "outbox" | "week";

const TABS: Array<{ id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "today", label: "Heute", icon: Calendar },
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "outbox", label: "Outbox", icon: Send },
  { id: "week", label: "Woche", icon: BarChart3 },
];

function greetingFor(hour: number): string {
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

function ColumnSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        <div className="h-3 w-48 bg-muted/60 rounded animate-pulse" />
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export const Dashboard = () => {
  const { data, isLoading, dataUpdatedAt } = useDashboardData();
  const { user } = useAdminAuth();
  const [tab, setTab] = useState<MobileTab>("today");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const operations = data?.operations || [];
  const inbox = data?.inbox || [];
  const stale = data?.staleInquiries || [];
  const overdue = data?.overduePayments || [];
  const byDay = data?.byDay || {};
  const weekStats = data?.weekStats || { eventsCount: 0, cateringCount: 0, guestsCount: 0, revenueCents: 0, paidCents: 0 };
  const nextWeek = data?.nextWeek || { count: 0, guests: 0, risks: 0 };

  const todayKey = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, "0"), d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const todayOps = operations.filter(o => o.date === todayKey);
  const decisionsCount = inbox.length + overdue.length;
  // Hero shows the next operation within 24h — count it for header consistency
  const heroOpCount = useMemo(() => {
    const horizon = now.getTime() + 24 * 60 * 60_000;
    return operations.filter(op => {
      const [y, m, d] = op.date.split("-").map(Number);
      const [hh, mm] = (op.time || "12:00").split(":").map(Number);
      const t = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0).getTime();
      return t > now.getTime() - 30 * 60_000 && t < horizon;
    }).length;
  }, [operations, now]);
  const visibleTodayCount = Math.max(todayOps.length, heroOpCount);
  const firstName = getAdminFirstName(user?.email || null);
  const greeting = greetingFor(now.getHours());

  const lastUpdateLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const sec = Math.max(0, Math.floor((now.getTime() - dataUpdatedAt) / 1000));
    if (sec < 5) return "gerade eben";
    if (sec < 60) return `vor ${sec}s`;
    const min = Math.floor(sec / 60);
    return `vor ${min} Min`;
  }, [dataUpdatedAt, now]);

  return (
    <AdminLayout activeTab="dashboard" title="Maestro" showCreateButton={true} createButtonText="Neue Anfrage">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground inline-flex items-center gap-2">
            <span>Pinnwand · {dateLabel}</span>
            {!isLoading && lastUpdateLabel && (
              <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-muted-foreground/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-60" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-foreground" />
                </span>
                <span className="tabular-nums">Live · {lastUpdateLabel}</span>
              </span>
            )}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-foreground font-medium tabular-nums">{visibleTodayCount}</span> Termin{visibleTodayCount === 1 ? "" : "e"} heute
              {decisionsCount > 0 && (
                <> · <span className="text-foreground font-medium tabular-nums">{decisionsCount}</span> Entscheidung{decisionsCount === 1 ? "" : "en"} wartet</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="h-32 rounded-3xl bg-muted/40 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ColumnSkeleton />
            <ColumnSkeleton />
            <ColumnSkeleton />
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Hero "Now" card */}
          <div className="mb-6">
            <NextUpHero operations={operations} />
          </div>

          {/* Mobile tab bar */}
          <div className="lg:hidden -mx-4 mb-5 sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60">
            <div className="flex">
              {TABS.map(t => {
                const Icon = t.icon;
                const active = tab === t.id;
                const badge =
                  t.id === "today" ? todayOps.length :
                  t.id === "inbox" ? inbox.length + overdue.length :
                  undefined;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-3 px-2 text-[11px] font-medium transition-colors relative min-h-[44px]",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <span className="relative">
                      <Icon className="h-4 w-4" />
                      {badge != null && badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-foreground text-background text-[9px] font-bold rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center tabular-nums">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </span>
                    {t.label}
                    {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground rounded-full" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop: Triptych + Week */}
          <div className="hidden lg:block space-y-8">
            <div className="grid grid-cols-3 gap-8">
              <TodayOperationsColumn operations={operations} />
              <InboxColumn inbox={inbox} stale={stale} overduePayments={overdue} />
              <OutboxColumn />
            </div>
            <WeekHeatmap byDay={byDay} weekStats={weekStats} nextWeek={nextWeek} />
          </div>

          {/* Mobile: One tab at a time */}
          <div className="lg:hidden">
            {tab === "today" && <TodayOperationsColumn operations={operations} />}
            {tab === "inbox" && <InboxColumn inbox={inbox} stale={stale} overduePayments={overdue} />}
            {tab === "outbox" && <OutboxColumn />}
            {tab === "week" && <WeekHeatmap byDay={byDay} weekStats={weekStats} nextWeek={nextWeek} />}
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default Dashboard;
