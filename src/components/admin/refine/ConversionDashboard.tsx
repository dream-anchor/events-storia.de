import { useMemo, useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { useConversionData, type ConversionRange, type FunnelStage } from "@/hooks/useConversionData";
import { DiagnosticsSection } from "./diagnostics/DiagnosticsSection";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatEur } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Clock, Euro, Inbox, CheckCircle2,
  AlertTriangle, Eye,
} from "lucide-react";

type RangeKey = "30d" | "90d" | "12m" | "ytd" | "all";

const RANGE_LABELS: Record<RangeKey, string> = {
  "30d": "Letzte 30 Tage",
  "90d": "Letzte 90 Tage",
  "12m": "Letzte 12 Monate",
  ytd: "Dieses Jahr",
  all: "Gesamt",
};

function computeRange(key: RangeKey): ConversionRange {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  switch (key) {
    case "30d": {
      const f = new Date(now); f.setDate(f.getDate() - 30);
      return { from: iso(f), to: null };
    }
    case "90d": {
      const f = new Date(now); f.setDate(f.getDate() - 90);
      return { from: iso(f), to: null };
    }
    case "12m": {
      const f = new Date(now); f.setMonth(f.getMonth() - 12);
      return { from: iso(f), to: null };
    }
    case "ytd":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: null };
    case "all":
    default:
      return { from: null, to: null };
  }
}

function KpiCard({
  icon, label, value, sub, tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "bad" ? "text-red-600"
    : "text-foreground";
  return (
    <Card className="p-4 rounded-2xl">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function FunnelBars({ funnel }: { funnel: FunnelStage[] }) {
  const max = funnel?.[0]?.count || 1;
  const colors = [
    "bg-sky-500/80", "bg-teal-500/80", "bg-amber-500/80",
    "bg-emerald-500/80", "bg-emerald-600/90", "bg-emerald-700/90",
  ];
  return (
    <div className="space-y-2">
      {funnel?.map((s, i) => {
        const widthPct = Math.max(4, Math.round((s.count / max) * 100));
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-sm text-foreground">{s.label}</div>
            <div className="flex-1 h-9 bg-muted/40 rounded-lg overflow-hidden relative">
              <div
                className={`h-full ${colors[i]} rounded-lg flex items-center px-3 transition-all`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-xs font-medium text-white drop-shadow-sm">{s.count}</span>
              </div>
            </div>
            <div className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {i === 0 ? "100 %" : `${s.totalRate} % · ↓${s.stepRate} %`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConversionDashboard() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("90d");
  const range = useMemo(() => computeRange(rangeKey), [rangeKey]);
  const { data, isLoading } = useConversionData(range);

  return (
    <AdminLayout activeTab="auswertung" title="Auswertung">
      <div className="space-y-8 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Warum nicht gebucht?</h1>
            <p className="text-sm text-muted-foreground">
              Wo Anfragen verloren gehen — mit konkreten Hinweisen, was zu tun ist.
            </p>
          </div>
          <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
            <SelectTrigger className="w-48 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                <SelectItem key={k} value={k}>{RANGE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Diagnose — warum konvertiert nicht? */}
        <DiagnosticsSection range={range} />

        {/* Zahlen im Detail */}
        {!isLoading && data && data.totals.inquiries > 0 && (
          <div className="space-y-6 pt-2 border-t border-border/40">
            <h2 className="text-base font-medium pt-4">Zahlen im Detail</h2>

            {/* KPI-Reihe */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard
                icon={<Inbox className="h-3.5 w-3.5" />}
                label="Anfragen"
                value={String(data.totals.inquiries)}
                sub={`${data.totals.open} offen in Bearbeitung`}
              />
              <KpiCard
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Zusage-Rate"
                value={`${data.rates.bookedRate} %`}
                sub={`${data.totals.booked} gebucht`}
                tone={data.rates.bookedRate >= 25 ? "good" : data.rates.bookedRate >= 12 ? "warn" : "bad"}
              />
              <KpiCard
                icon={<Euro className="h-3.5 w-3.5" />}
                label="Fix-Rate"
                value={`${data.rates.paidRate} %`}
                sub={`${data.totals.paid} bezahlt`}
                tone={data.rates.paidRate >= 18 ? "good" : data.rates.paidRate >= 8 ? "warn" : "bad"}
              />
              <KpiCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Umsatz (fix)"
                value={formatEur(data.revenue.paidCents)}
                sub={data.revenue.avgOrderCents != null ? `Ø ${formatEur(data.revenue.avgOrderCents)} / Auftrag` : undefined}
              />
              <KpiCard
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Ø bis Angebot"
                value={data.timing.avgDaysToOffer != null ? `${data.timing.avgDaysToOffer} T` : "—"}
                sub={data.timing.medianDaysToOffer != null ? `Median ${data.timing.medianDaysToOffer} T` : "Reaktionszeit"}
                tone={data.timing.avgDaysToOffer != null && data.timing.avgDaysToOffer > 3 ? "warn" : "neutral"}
              />
            </div>

            {/* Funnel */}
            <Card className="p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Funnel</h3>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> Öffnungsrate {data.rates.openRate} %
                  </span>
                  <span>geöffnet → gebucht {data.rates.openToBookedRate} %</span>
                </div>
              </div>
              <FunnelBars funnel={data.funnel} />
              {data.totals.offersOpened === 0 && data.totals.offersSent > 0 && (
                <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Noch keine Angebots-Öffnungen erfasst — Tracking greift erst für ab jetzt verschickte Angebote.
                </p>
              )}
            </Card>

            {/* Verloren + Kanäle */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5 rounded-2xl">
                <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Verloren
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {data.lost.total} verloren · {data.lost.cancelled} storniert · {data.lost.declined} abgelehnt · {data.lost.noResponse} ohne Antwort
                </p>
                {data.lost.reasons.length > 0 ? (
                  <div className="space-y-2">
                    {data.lost.reasons.map((r) => (
                      <div key={r.key} className="flex items-center justify-between text-sm">
                        <span>{r.label}</span>
                        <span className="tabular-nums text-muted-foreground">{r.count}</span>
                      </div>
                    ))}
                    {data.lost.missingReason > 0 && (
                      <div className="flex items-center justify-between text-sm text-amber-600">
                        <span>Ohne Grund erfasst</span>
                        <span className="tabular-nums">{data.lost.missingReason}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data.lost.total === 0
                      ? "Keine verlorenen Anfragen."
                      : "Noch keine Verlust-Gründe erfasst."}
                  </p>
                )}
              </Card>

              <Card className="p-5 rounded-2xl">
                <h3 className="text-lg font-medium mb-3">Conversion nach Kanal</h3>
                <BreakdownTable rows={data.bySource} />
              </Card>
            </div>

            {/* Team */}
            {data.byStaff.some((s) => s.key !== "__none__") && (
              <Card className="p-5 rounded-2xl">
                <h3 className="text-lg font-medium mb-3">Conversion nach Mitarbeiter</h3>
                <BreakdownTable rows={data.byStaff} />
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function BreakdownTable({
  rows,
}: {
  rows: Array<{
    key: string; label: string; inquiries: number;
    booked: number; paid: number; bookedRate: number; paidRate: number; revenueCents: number;
  }>;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Keine Daten.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground text-left">
            <th className="pb-2 font-normal">Quelle</th>
            <th className="pb-2 font-normal text-right">Anfragen</th>
            <th className="pb-2 font-normal text-right">Zusage</th>
            <th className="pb-2 font-normal text-right">Fix</th>
            <th className="pb-2 font-normal text-right">Umsatz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border/40">
              <td className="py-2">{r.label}</td>
              <td className="py-2 text-right tabular-nums">{r.inquiries}</td>
              <td className="py-2 text-right tabular-nums">{r.bookedRate} %</td>
              <td className="py-2 text-right tabular-nums">{r.paidRate} %</td>
              <td className="py-2 text-right tabular-nums">{formatEur(r.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConversionDashboard;
