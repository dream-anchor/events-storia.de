// Temporal-Polyfill wird zentral in src/main.tsx geladen (vor allen anderen Modulen).
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import { createViewDay } from "@schedule-x/calendar";
import "@schedule-x/theme-default/dist/index.css";
import type { DashOperation } from "@/hooks/useDashboardData";
import "./schedule-x-theme.css";

// Schedule-X v4 erwartet echte Temporal-Objekte (nicht mehr Strings).
const TZ = "Europe/Berlin";
function toZoned(y: number, m: number, d: number, hh: number, mm: number) {
  // @ts-expect-error – Temporal via Polyfill (siehe src/main.tsx)
  return globalThis.Temporal.ZonedDateTime.from({
    year: y, month: m, day: d, hour: hh, minute: mm, timeZone: TZ,
  });
}

function buildEvents(operations: DashOperation[], todayKey: string) {
  return operations
    .filter(op => op.date === todayKey)
    .map(op => {
      const [y, m, d] = op.date.split("-").map(Number);
      const [hh, mm] = (op.time || "12:00").split(":").map(Number);
      const start = toZoned(y, m || 1, d || 1, hh || 0, mm || 0);
      const end = start.add({ minutes: 90 });
      return {
        id: `${op.kind}-${op.id}`,
        title:
          op.kind === "catering"
            ? `${op.isPickup ? "Abh." : "Lieferung"} · ${op.customerName}`
            : op.customerName,
        start,
        end,
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