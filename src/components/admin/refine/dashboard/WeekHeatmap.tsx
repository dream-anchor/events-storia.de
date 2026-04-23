import { format, parseISO, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

function formatEUR(cents: number): string {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

export function WeekHeatmap({
  byDay,
  weekStats,
  nextWeek,
}: {
  byDay: Record<string, { events: number; catering: number; guests: number; revenueCents: number }>;
  weekStats: { eventsCount: number; cateringCount: number; guestsCount: number; revenueCents: number; paidCents: number };
  nextWeek: { count: number; guests: number; risks: number };
}) {
  const allKeys = Object.keys(byDay).sort();
  const week = allKeys.slice(0, 7);
  const maxGuests = Math.max(1, ...week.map(k => byDay[k].guests));

  const total = weekStats.revenueCents;
  const paidPct = total > 0 ? Math.round((weekStats.paidCents / total) * 100) : 0;

  return (
    <section className="bg-card rounded-2xl border border-border/60 p-5 sm:p-6">
      <header className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Diese Woche</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {week.length > 0 && (
              <>
                {format(parseISO(week[0]), "d. MMM", { locale: de })} – {format(parseISO(week[6]), "d. MMM", { locale: de })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-bold text-foreground">{weekStats.eventsCount + weekStats.cateringCount}</span> Termine</span>
          <span><span className="font-bold text-foreground">{weekStats.guestsCount}</span> Gäste</span>
          <span><span className="font-bold text-foreground">{formatEUR(total)}</span></span>
          {total > 0 && <span><span className="font-bold text-foreground">{paidPct}%</span> bezahlt</span>}
        </div>
      </header>

      <div className="grid grid-cols-7 gap-2">
        {week.map(key => {
          const slot = byDay[key];
          const d = parseISO(key);
          const t = isToday(d);
          const heightPct = (slot.guests / maxGuests) * 100;
          const total = slot.events + slot.catering;

          return (
            <div key={key} className={cn(
              "rounded-xl p-2 border transition-colors",
              t ? "border-foreground bg-foreground/5" : "border-border/60 bg-muted/30"
            )}>
              <div className="text-center mb-2">
                <p className={cn("text-[10px] uppercase tracking-wider", t ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {format(d, "EEE", { locale: de })}
                </p>
                <p className={cn("text-sm tabular-nums", t ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {format(d, "d")}
                </p>
              </div>
              {/* Bar */}
              <div className="relative h-16 bg-muted/50 rounded-lg overflow-hidden">
                {total > 0 && (
                  <div
                    className={cn("absolute bottom-0 left-0 right-0 transition-all", t ? "bg-foreground" : "bg-foreground/40")}
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                  />
                )}
              </div>
              {/* Stats */}
              <div className="mt-2 text-center">
                <p className="text-[11px] font-semibold text-foreground tabular-nums">{slot.guests || "—"}</p>
                <p className="text-[9px] text-muted-foreground tabular-nums">
                  {total > 0 ? `${total} Term.` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next week outlook */}
      <div className="mt-5 pt-4 border-t border-border/60 flex items-center gap-3 text-xs flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Nächste Woche</span>
        <span className="text-muted-foreground">
          <span className="font-bold text-foreground">{nextWeek.count}</span> Termine
        </span>
        <span className="text-muted-foreground">
          <span className="font-bold text-foreground">{nextWeek.guests}</span> Gäste
        </span>
        {nextWeek.risks > 0 && (
          <span className="ml-auto text-foreground font-medium inline-flex items-center gap-1">
            ⚠ {nextWeek.risks} Buchung{nextWeek.risks > 1 ? "en" : ""} ohne Menüfreigabe
          </span>
        )}
      </div>
    </section>
  );
}