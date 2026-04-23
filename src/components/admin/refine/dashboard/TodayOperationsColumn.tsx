import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Phone, MapPin, Calendar, Package, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashOperation } from "@/hooks/useDashboardData";

type StatusPill = { label: string; tone: "solid" | "muted" | "outline" | "destructive" };

function statusPill(op: DashOperation): StatusPill {
  if (op.kind === "catering") {
    if (op.paymentStatus === "paid") return { label: "Bezahlt", tone: "solid" };
    if (op.status === "pending") return { label: "Offen", tone: "outline" };
    return { label: op.status, tone: "muted" };
  }
  if (op.kind === "booking") {
    if (op.menuConfirmed === false) return { label: "Menü offen", tone: "outline" };
    if (op.paymentStatus === "paid") return { label: "Bezahlt", tone: "solid" };
    return { label: op.status, tone: "muted" };
  }
  return { label: "Bestätigt", tone: "solid" };
}

function pillClass(tone: StatusPill["tone"]): string {
  switch (tone) {
    case "solid": return "bg-foreground text-background";
    case "outline": return "bg-transparent text-foreground border border-foreground/30";
    case "destructive": return "bg-destructive/10 text-destructive border border-destructive/30";
    case "muted":
    default: return "bg-muted text-muted-foreground";
  }
}

function kindLabel(op: DashOperation): string {
  if (op.kind === "catering") return op.isPickup ? "Abholung" : "Lieferung";
  if (op.kind === "booking") return "Event";
  return "Event";
}

function OpCard({ op }: { op: DashOperation }) {
  const navigate = useNavigate();
  const dot = statusDot(op);
  const phoneClean = op.phone?.replace(/[^+\d]/g, "");
  const mapsUrl = op.address && !op.isPickup
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.address)}`
    : null;

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        {op.time && (
          <div className="flex-shrink-0">
            <span className="text-xl font-bold text-foreground tabular-nums leading-none">{op.time}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {kindLabel(op)}
            </span>
            <span className={cn("h-1.5 w-1.5 rounded-full", dot.color)} />
            <span className="text-[11px] text-muted-foreground">{dot.label}</span>
          </div>
          <button
            onClick={() => navigate(op.navigateTo)}
            className="block w-full text-left mt-1.5 group"
          >
            <p className="font-semibold text-sm text-foreground truncate group-hover:underline">{op.customerName}</p>
            {op.companyName && <p className="text-xs text-muted-foreground truncate">{op.companyName}</p>}
          </button>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {op.guestCount != null && (
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{op.guestCount}</span>
            )}
            {op.address && (
              <span className="truncate inline-flex items-center gap-1">
                {op.isPickup ? <Package className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                <span className="truncate">{op.address}</span>
              </span>
            )}
          </div>
          {(phoneClean || mapsUrl) && (
            <div className="flex items-center gap-2 mt-3">
              {phoneClean && (
                <a
                  href={`tel:${phoneClean}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted hover:bg-muted/70 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" /> Anrufen
                </a>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted hover:bg-muted/70 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" /> Navigieren
                </a>
              )}
            </div>
          )}
        </div>
        <button onClick={() => navigate(op.navigateTo)} className="flex-shrink-0 p-1 -mr-1 text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TodayOperationsColumn({ operations }: { operations: DashOperation[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, DashOperation[]> = {};
    operations.forEach(op => {
      if (!map[op.date]) map[op.date] = [];
      map[op.date].push(op);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [operations]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Heute läuft</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Operations · nächste 7 Tage</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {operations.length}
        </span>
      </header>

      {grouped.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm bg-muted/30 rounded-2xl">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Keine geplanten Lieferungen oder Events
        </div>
      )}

      {grouped.map(([date, ops]) => {
        let d: Date; try { d = parseISO(date); } catch { d = new Date(date); }
        const t = isToday(d);
        const tm = isTomorrow(d);
        const label = t ? "Heute" : tm ? "Morgen" : format(d, "EEEE, d. MMMM", { locale: de });
        return (
          <section key={date} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold", t ? "text-foreground" : "text-muted-foreground")}>{label}</h3>
              {t && <span className="text-[10px] font-bold uppercase tracking-wider text-background bg-foreground px-1.5 py-0.5 rounded-full">live</span>}
              <div className="flex-1 h-px bg-border/60" />
              <span className="text-[11px] text-muted-foreground">{ops.length}</span>
            </div>
            <div className="space-y-2">
              {ops.map(op => <OpCard key={`${op.kind}-${op.id}`} op={op} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}