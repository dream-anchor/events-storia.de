import { useState } from "react";
import { Calendar, Inbox as InboxIcon, Send, BarChart3, Loader2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { TodayOperationsColumn } from "./dashboard/TodayOperationsColumn";
import { InboxColumn } from "./dashboard/InboxColumn";
import { OutboxColumn } from "./dashboard/OutboxColumn";
import { WeekHeatmap } from "./dashboard/WeekHeatmap";

type MobileTab = "today" | "inbox" | "outbox" | "week";

const TABS: Array<{ id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "today", label: "Heute", icon: Calendar },
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "outbox", label: "Outbox", icon: Send },
  { id: "week", label: "Woche", icon: BarChart3 },
];

export const Dashboard = () => {
  const { data, isLoading } = useDashboardData();
  const [tab, setTab] = useState<MobileTab>("today");

  const today = new Date();
  const dateLabel = today.toLocaleDateString("de-DE", {
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

  // Filter today operations for "today" tab on mobile
  const todayKey = (() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, "0"), d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  return (
    <AdminLayout activeTab="dashboard" title="Maestro" showCreateButton={true} createButtonText="Neue Anfrage">
      {/* Top header strip */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Pinnwand</p>
          <h1 className="text-2xl font-bold text-foreground capitalize mt-0.5">{dateLabel}</h1>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lädt …
          </div>
        )}
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden -mx-4 mb-5 sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            const badge =
              t.id === "today" ? operations.filter(o => o.date === todayKey).length :
              t.id === "inbox" ? inbox.length + overdue.length :
              t.id === "outbox" ? undefined :
              undefined;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 px-2 text-[11px] font-medium transition-colors relative",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="h-4 w-4" />
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-foreground text-background text-[9px] font-bold rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center">
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
      <div className="hidden lg:block space-y-6">
        <div className="grid grid-cols-3 gap-6">
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
    </AdminLayout>
  );
};

export default Dashboard;