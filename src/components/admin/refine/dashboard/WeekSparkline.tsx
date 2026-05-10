import { cn } from "@/lib/utils";

interface Props {
  byDay: Record<string, { events: number; catering: number; guests: number; revenueCents: number }>;
}

const DAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function WeekSparkline({ byDay }: Props) {
  const keys = Object.keys(byDay).slice(0, 7);
  const values = keys.map(k => ({
    key: k,
    total: (byDay[k]?.events || 0) + (byDay[k]?.catering || 0),
    guests: byDay[k]?.guests || 0,
  }));
  const max = Math.max(1, ...values.map(v => v.total));

  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-foreground/70">
          Diese Woche
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {values.reduce((s, v) => s + v.total, 0)} Termine
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {values.map(v => {
          const h = Math.max(4, Math.round((v.total / max) * 56));
          const [y, m, d] = v.key.split("-").map(Number);
          const date = new Date(y, (m || 1) - 1, d || 1);
          const label = DAY_LABELS[date.getDay()];
          return (
            <div key={v.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className={cn(
                  "w-full rounded-t-md transition-colors",
                  v.total > 0 ? "bg-foreground/70" : "bg-foreground/10"
                )}
                style={{ height: `${h}px` }}
                title={`${v.total} Termine · ${v.guests} Gäste`}
              />
              <span className="text-[9px] text-muted-foreground tabular-nums">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}