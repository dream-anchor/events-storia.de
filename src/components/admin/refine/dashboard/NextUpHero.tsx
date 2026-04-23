import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, MapPin, ArrowRight, Clock, Users, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashOperation } from "@/hooks/useDashboardData";

function parseOpDateTime(op: DashOperation): Date {
  const [y, m, d] = op.date.split("-").map(Number);
  if (op.time) {
    const [hh, mm] = op.time.split(":").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  }
  return new Date(y, (m || 1) - 1, d || 1, 12, 0);
}

function formatRelative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) return "läuft jetzt";
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "in Kürze";
  if (mins < 60) return `in ${mins} Min`;
  const hours = Math.floor(mins / 60);
  const restMin = mins % 60;
  if (hours < 8) return restMin > 0 ? `in ${hours}h ${restMin}m` : `in ${hours}h`;
  // tomorrow / later
  const sameDay = target.toDateString() === now.toDateString();
  if (sameDay) return `in ${hours}h`;
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (target.toDateString() === tomorrow.toDateString()) {
    return `morgen ${target.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return target.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
}

function kindLabel(op: DashOperation): string {
  if (op.kind === "catering") return op.isPickup ? "Abholung" : "Lieferung";
  return "Event";
}

export function NextUpHero({ operations }: { operations: DashOperation[] }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Find next upcoming operation (within next ~24h, future only)
  const upcoming = operations
    .map(op => ({ op, when: parseOpDateTime(op) }))
    .filter(x => x.when.getTime() > now.getTime() - 30 * 60_000) // include 30min back (running)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const next = upcoming[0];

  if (!next) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-muted/40 to-muted/10 border border-border/40 px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-foreground/5 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Jetzt</p>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-1">Heute frei — keine offenen Termine</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Zeit für Vorbereitung, Akquise oder Ruhe.</p>
          </div>
        </div>
      </section>
    );
  }

  const op = next.op;
  const when = next.when;
  const relative = formatRelative(when, now);
  const isImminent = when.getTime() - now.getTime() < 2 * 60 * 60_000 && when.getTime() >= now.getTime() - 30 * 60_000;
  const isRunning = when.getTime() <= now.getTime();
  const phoneClean = op.phone?.replace(/[^+\d]/g, "");
  const mapsUrl = op.address && !op.isPickup
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.address)}`
    : null;

  return (
    <section className={cn(
      "relative overflow-hidden rounded-3xl border px-6 py-6 sm:px-8 sm:py-7 transition-colors",
      isImminent
        ? "bg-foreground text-background border-foreground"
        : "bg-card border-border/60"
    )}>
      {/* Accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1",
        isImminent ? "bg-background/80" : "bg-foreground"
      )} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
        {/* Time block */}
        <div className="flex items-baseline gap-3 sm:flex-col sm:items-start sm:gap-1 flex-shrink-0">
          <p className={cn(
            "text-[10px] uppercase tracking-[0.2em] font-semibold",
            isImminent ? "text-background/70" : "text-muted-foreground"
          )}>
            {isRunning ? "Läuft jetzt" : "Als nächstes"}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-4xl sm:text-5xl font-bold tabular-nums leading-none tracking-tight",
              isImminent ? "text-background" : "text-foreground"
            )}>
              {op.time || "—"}
            </span>
            <span className={cn(
              "text-sm font-medium",
              isImminent ? "text-background/80" : "text-muted-foreground"
            )}>
              · {relative}
            </span>
          </div>
        </div>

        {/* Content */}
        <button
          onClick={() => navigate(op.navigateTo)}
          className="flex-1 min-w-0 text-left group"
        >
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              "text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full",
              isImminent ? "bg-background/15 text-background" : "bg-muted text-muted-foreground"
            )}>
              {kindLabel(op)}
            </span>
            {op.guestCount != null && (
              <span className={cn(
                "inline-flex items-center gap-1 text-xs",
                isImminent ? "text-background/80" : "text-muted-foreground"
              )}>
                <Users className="h-3 w-3" />{op.guestCount} P.
              </span>
            )}
          </div>
          <p className={cn(
            "text-xl sm:text-2xl font-semibold tracking-tight truncate group-hover:underline underline-offset-4",
            isImminent ? "text-background" : "text-foreground"
          )}>
            {op.customerName}
          </p>
          {(op.address || op.companyName) && (
            <p className={cn(
              "text-sm mt-0.5 truncate inline-flex items-center gap-1.5",
              isImminent ? "text-background/80" : "text-muted-foreground"
            )}>
              {op.address ? <MapPin className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
              <span className="truncate">{op.address || op.companyName}</span>
            </p>
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {phoneClean && (
            <a
              href={`tel:${phoneClean}`}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-sm font-medium transition-colors",
                isImminent
                  ? "bg-background/15 hover:bg-background/25 text-background"
                  : "bg-muted hover:bg-muted/70 text-foreground"
              )}
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Anrufen</span>
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-sm font-medium transition-colors",
                isImminent
                  ? "bg-background/15 hover:bg-background/25 text-background"
                  : "bg-muted hover:bg-muted/70 text-foreground"
              )}
            >
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Route</span>
            </a>
          )}
          <button
            onClick={() => navigate(op.navigateTo)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-sm font-semibold transition-colors",
              isImminent
                ? "bg-background text-foreground hover:bg-background/90"
                : "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            <span className="hidden sm:inline">Öffnen</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Subtle clock indicator bottom */}
      {isImminent && !isRunning && (
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-background/60">
          <Clock className="h-3 w-3" />
          <span className="tabular-nums">{when.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
    </section>
  );
}