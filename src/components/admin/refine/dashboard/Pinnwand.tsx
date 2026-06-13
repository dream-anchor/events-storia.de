import { useMemo, useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardTasks } from "@/hooks/useDashboardTasks";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { getAdminFirstName } from "@/lib/adminDisplayNames";
import { bucketCounts } from "@/lib/dashboardPriority";
import { WorklistFilters, type WorklistFiltersValue } from "./WorklistFilters";
import { WorklistTable } from "./WorklistTable";
import { DayTimelineSidebar } from "./DayTimelineSidebar";
import { WeekSparkline } from "./WeekSparkline";
import { EmailFailureTile } from "./EmailFailureTile";

function greetingFor(hour: number): string {
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

function ColumnSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function Pinnwand() {
  const { tasks, isLoading, dataUpdatedAt, now } = useDashboardTasks();
  const { data } = useDashboardData();
  const { user } = useAdminAuth();
  const [filters, setFilters] = useState<WorklistFiltersValue>({
    bucket: "all",
    types: [],
    query: "",
  });

  const dateLabel = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const todayKey = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);

  const counts = useMemo(() => bucketCounts(tasks), [tasks]);

  const filteredTasks = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return tasks.filter(t => {
      if (filters.bucket !== "all" && t.bucket !== filters.bucket) return false;
      if (filters.types.length > 0 && !filters.types.includes(t.serviceType)) return false;
      if (q) {
        const hay = `${t.title} ${t.subtitle || ""} ${t.customerName} ${t.reasons.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const firstName = getAdminFirstName(user?.email || null);
  const greeting = greetingFor(now.getHours());

  const lastUpdateLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const sec = Math.max(0, Math.floor((now.getTime() - dataUpdatedAt) / 1000));
    if (sec < 5) return "gerade eben";
    if (sec < 60) return `vor ${sec}s`;
    return `vor ${Math.floor(sec / 60)} Min`;
  }, [dataUpdatedAt, now]);

  return (
    <>
      <div className="mb-6">
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
            <span className="text-foreground font-medium tabular-nums">{counts.now}</span> jetzt
            {" · "}
            <span className="text-foreground font-medium tabular-nums">{counts.sla}</span> SLA-kritisch
            {" · "}
            <span className="text-foreground font-medium tabular-nums">{counts.today}</span> heute
            {" · "}
            <span className="text-foreground font-medium tabular-nums">{counts.week}</span> diese Woche
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <ColumnSkeleton />
          <ColumnSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
          <div>
            <WorklistFilters
              value={filters}
              onChange={setFilters}
              bucketCounts={counts}
              total={tasks.length}
            />
            <WorklistTable tasks={filteredTasks} now={now} />
          </div>
          <div className="space-y-4">
            <EmailFailureTile />
            <DayTimelineSidebar
              operations={data?.operations || []}
              todayKey={todayKey}
            />
            <WeekSparkline byDay={data?.byDay || {}} />
          </div>
        </div>
      )}
    </>
  );
}