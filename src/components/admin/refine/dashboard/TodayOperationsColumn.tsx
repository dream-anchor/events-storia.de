import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Phone, MapPin, Calendar, Package, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashOperation } from "@/hooks/useDashboardData";
import { useOperationActions } from "@/hooks/useOperationActions";
import { Check } from "lucide-react";

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
  const { completeOperation } = useOperationActions();
  const pill = statusPill(op);
  const phoneClean = op.phone?.replace(/[^+\d]/g, "");
  const mapsUrl = op.address && !op.isPickup
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.address)}`
    : null;

  return (
    <div className="group bg-card rounded-xl px-4 py-3.5 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-b-0">
      <div className="flex items-start gap-3">
        {op.time && (
          <div className="flex-shrink-0">
            <span className="text-lg font-semibold text-foreground tabular-nums leading-none">{op.time}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {kindLabel(op)}
            </span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide", pillClass(pill.tone))}>
              {pill.label}
            </span>
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
      <div className="mt-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); completeOperation.mutate({ id: op.id, kind: op.kind }); }}
          disabled={completeOperation.isPending}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted px-2 py-1 rounded-md min-h-[32px] disabled:opacity-40"
        >
          <Check className="h-3 w-3" /> Erledigt
        </button>
      </div>
    </div>
  );
}

export function TodayOperationsColumn({ operations }: { operations: DashOperation[] }) {
  const [showWeek, setShowWeek] = useState(false);

  const todayKey = useMemo(() => {
    const t = new Date();
    const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, "0"), d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const filtered = useMemo(
    () => (showWeek ? operations : operations.filter(op => op.date === todayKey)),
    [operations, showWeek, todayKey]
  );

  const todayCount = useMemo(
    () => operations.filter(op => op.date === todayKey).length,
    [operations, todayKey]
  );

  const grouped = useMemo(() => {
    const map: Record<string, DashOperation[]> = {};
    filtered.forEach(op => {
      if (!map[op.date]) map[op.date] = [];
      map[op.date].push(op);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Heute</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {showWeek ? "Operations · nächste 7 Tage" : `${todayCount} Termin${todayCount === 1 ? "" : "e"} heute`}
          </p>
        </div>
        <button
          onClick={() => setShowWeek(v => !v)}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-md hover:bg-muted"
        >
          {showWeek ? "Nur heute" : "+7 Tage"}
        </button>
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