import { useEffect, useMemo, useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { buildTasks, type DashTask } from "@/lib/dashboardPriority";

export function useDashboardTasks(): {
  tasks: DashTask[];
  isLoading: boolean;
  dataUpdatedAt: number;
  now: Date;
} {
  const { data, isLoading, dataUpdatedAt } = useDashboardData();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id: ReturnType<typeof setInterval> = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const tasks = useMemo(() => buildTasks(data, now), [data, now]);
  return { tasks, isLoading, dataUpdatedAt, now };
}