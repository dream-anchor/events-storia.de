// Polyfill für Temporal API (fehlt auf iOS Safari) — muss vor @schedule-x importiert werden
import "@js-temporal/polyfill";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import { createViewDay } from "@schedule-x/calendar";
import "@schedule-x/theme-default/dist/index.css";
import type { DashOperation } from "@/hooks/useDashboardData";
import "./schedule-x-theme.css";

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtSx(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildEvents(operations: DashOperation[], todayKey: string) {
  return operations
    .filter(op => op.date === todayKey)
    .map(op => {
      const [y, m, d] = op.date.split("-").map(Number);
      const [hh, mm] = (op.time || "12:00").split(":").map(Number);
      const start = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
      const end = new Date(start.getTime() + 90 * 60_000);
      return {
        id: `${op.kind}-${op.id}`,
        title:
          op.kind === "catering"
            ? `${op.isPickup ? "Abh." : "Lieferung"} · ${op.customerName}`
            : op.customerName,
        start: fmtSx(start),
        end: fmtSx(end),
        _navigate: op.navigateTo,
      } as const;
    });
}

interface Props {
  operations: DashOperation[];
  todayKey: string;
}

export function DayTimelineSidebar({ operations, todayKey }: Props) {
  const navigate = useNavigate();
  const navRef = useRef(navigate);
  navRef.current = navigate;

  const events = useMemo(() => buildEvents(operations, todayKey), [operations, todayKey]);

  const dayView = useMemo(() => createViewDay(), []);
  const calendar = useNextCalendarApp({
    views: [dayView],
    defaultView: dayView.name,
    locale: "de-DE",
    firstDayOfWeek: 1,
    dayBoundaries: { start: "08:00", end: "23:00" },
    events,
    callbacks: {
      onEventClick: (ev: any) => {
        if (ev?._navigate) navRef.current(ev._navigate);
      },
    },
  });

  useEffect(() => {
    if (!calendar) return;
    calendar.events.set(events);
  }, [calendar, events]);

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-foreground/70">
          Heute · Timeline
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{events.length}</span>
      </div>
      <div className="sx-pinnwand h-[420px]">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>
      {events.length === 0 && (
        <div className="px-4 py-3 border-t border-border/60 text-[11px] text-muted-foreground">
          Heute keine Termine.
        </div>
      )}
    </div>
  );
}