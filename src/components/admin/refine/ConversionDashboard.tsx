import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/typed-client";
import { AdminLayout } from "./AdminLayout";
import {
  useConversionData, type ConversionRange, type FunnelStage,
  LOSS_REASON_LABELS,
} from "@/hooks/useConversionData";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Clock, Euro, Inbox, CheckCircle2,
  AlertTriangle, Eye,
} from "lucide-react";

const LOST_STATUS_LABELS: Record<string, string> = {
  cancelled: "Storniert",
  offer_declined: "Abgelehnt",
  no_response: "Keine Antwort",
  payment_failed: "Zahlung fehlgeschlagen",
};

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

function eur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  });
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
  const queryClient = useQueryClient();

  const setLossReason = async (id: string, reason: string) => {
    const { error } = await supabase
      .from("v2_events")
      .update({ loss_reason: reason })
      .eq("id", id);
    if (error) {
      toast.error("Konnte Grund nicht speichern");
      return;
    }
    toast.success("Grund gespeichert");
    queryClient.invalidateQueries({ queryKey: ["conversion-data"] });
  };

  return (
    <AdminLayout activeTab="auswertung" title="Auswertung">
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Conversion</h1>
            <p className="text-sm text-muted-foreground">
              Von der Anfrage zur fixen Buchung — wo der Funnel leckt.
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

        {isLoading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : data.totals.inquiries === 0 ? (
          <Card className="p-8 rounded-2xl text-center text-muted-foreground">
            Keine Anfragen im gewählten Zeitraum.
          </Card>
        ) : (
          <>
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
                value={eur(data.revenue.paidCents)}
                sub={data.revenue.avgOrderCents != null ? `Ø ${eur(data.revenue.avgOrderCents)} / Auftrag` : undefined}
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
                <h2 className="text-lg font-medium">Funnel</h2>
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
                <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Verloren
                </h2>
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
                <h2 className="text-lg font-medium mb-3">Conversion nach Kanal</h2>
                <BreakdownTable rows={data.bySource} />
              </Card>
            </div>

            {/* Team */}
            {data.byStaff.some((s) => s.key !== "__none__") && (
              <Card className="p-5 rounded-2xl">
                <h2 className="text-lg font-medium mb-3">Conversion nach Mitarbeiter</h2>
                <BreakdownTable rows={data.byStaff} />
              </Card>
            )}

            {/* Verlust-Gründe nachtragen */}
            {data.lossInbox.length > 0 && (
              <Card className="p-5 rounded-2xl">
                <h2 className="text-lg font-medium mb-1">Verlust-Gründe nachtragen</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {data.lossInbox.length} verlorene Anfragen ohne Grund. Je vollständiger, desto klarer wird sichtbar, warum gebucht wird — und warum nicht.
                </p>
                <div className="space-y-2">
                  {data.lossInbox.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 truncate">{row.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0 w-28">
                        {LOST_STATUS_LABELS[row.status] || row.status}
                      </span>
                      <Select onValueChange={(v) => setLossReason(row.id, v)}>
                        <SelectTrigger className="w-44 h-8 rounded-lg shrink-0">
                          <SelectValue placeholder="Grund wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LOSS_REASON_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
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
              <td className="py-2 text-right tabular-nums">{eur(r.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConversionDashboard;
