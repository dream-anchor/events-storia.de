import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/typed-client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ShieldCheck, TrendingDown, AlertTriangle } from "lucide-react";
import {
  useInquiryDiagnostics, type DiagnosticsData,
} from "@/hooks/useInquiryDiagnostics";
import type { ConversionRange } from "@/hooks/useConversionData";
import { formatEur } from "@/lib/utils";
import { LeakCard } from "./LeakCard";
import { LostInquiryRow } from "./LostInquiryRow";

// Deterministischer Klartext-Befund (KI-Berater ersetzt dies in einer späteren Phase).
function composeBefund(d: DiagnosticsData): string {
  const s = d.summary;
  if (s.inquiries === 0) return "Keine Anfragen im gewählten Zeitraum.";

  const parts: string[] = [];
  parts.push(
    `In diesem Zeitraum kamen ${s.inquiries} Anfragen rein, davon wurden ${s.booked} gebucht (${s.bookedRate} %).`
  );

  const lostTotal = s.lostSecuredCents + s.lostEstimatedCents;
  const handled = s.lostCount + s.openStalledCount;
  if (handled > 0 && d.leaks.length > 0) {
    const moneyPart =
      lostTotal > 0
        ? s.lostEstimatedCents > 0
          ? ` mit zusammen rund ${formatEur(lostTotal)}`
          : ` mit ${formatEur(lostTotal)}`
        : "";
    parts.push(
      `${handled} Anfragen${moneyPart} sind verloren gegangen oder hängen fest.`
    );
    const top = d.leaks.slice(0, 2).map((l) => l.title.toLowerCase());
    if (top.length === 1) parts.push(`Größter Hebel: ${top[0]}.`);
    else if (top.length === 2)
      parts.push(`Die zwei größten Hebel: ${top[0]} und ${top[1]}.`);
  } else {
    parts.push("Aktuell gibt es kein nennenswertes Conversion-Leck — stark.");
  }
  return parts.join(" ");
}

export function DiagnosticsSection({ range }: { range: ConversionRange }) {
  const { data, isLoading, error: queryError } = useInquiryDiagnostics(range);
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);

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
    queryClient.invalidateQueries({ queryKey: ["inquiry-diagnostics"] });
    queryClient.invalidateQueries({ queryKey: ["conversion-data"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (queryError || !data) {
    const msg = queryError instanceof Error ? queryError.message : String(queryError ?? "Unbekannter Fehler");
    return (
      <Card className="p-5 rounded-2xl border-red-500/30 bg-red-500/5">
        <h2 className="text-base font-medium mb-2 flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-4 w-4" /> Auswertung konnte nicht geladen werden
        </h2>
        <pre className="text-sm text-red-600 bg-red-500/10 p-3 rounded-lg overflow-auto whitespace-pre-wrap">{msg}</pre>
      </Card>
    );
  }

  if (data.summary.inquiries === 0) {
    return (
      <Card className="p-8 rounded-2xl text-center text-muted-foreground">
        Keine Anfragen im gewählten Zeitraum.
      </Card>
    );
  }

  const weakOccasions = data.segments.byOccasion.filter((s) => s.belowAvg).slice(0, 3);
  const weakBuckets = data.segments.byGuestBucket.filter((s) => s.belowAvg).slice(0, 3);
  const visibleInquiries = showAll ? data.inquiries : data.inquiries.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Befund */}
      <Card className="p-4 md:p-5 rounded-2xl border-sky-500/30 bg-sky-500/[0.04]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-sky-700 mb-2">
          <Sparkles className="h-4 w-4" />
          Befund
        </div>
        <p className="text-[15px] leading-relaxed text-foreground">{composeBefund(data)}</p>
      </Card>

      {/* Größte Lecks */}
      <div>
        <h2 className="text-base font-medium mb-2.5">
          Die größten Lecks
          <span className="text-sm text-muted-foreground font-normal"> — nach entgangenem Umsatz</span>
        </h2>
        {data.leaks.length > 0 ? (
          <div className="space-y-2.5">
            {data.leaks.map((leak) => (
              <LeakCard key={leak.key} leak={leak} />
            ))}
          </div>
        ) : (
          <Card className="p-5 rounded-2xl flex items-center gap-2 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Kein nennenswertes Leck — alle Anfragen laufen sauber durch den Funnel.
          </Card>
        )}
      </div>

      {/* Einzeldiagnose */}
      {data.inquiries.length > 0 && (
        <div>
          <h2 className="text-base font-medium mb-2.5">
            Verlorene & festhängende Anfragen
            <span className="text-sm text-muted-foreground font-normal"> — Einzeldiagnose</span>
          </h2>
          <Card className="rounded-2xl overflow-hidden py-0">
            {visibleInquiries.map((d) => (
              <LostInquiryRow key={d.id} d={d} onSetLossReason={setLossReason} />
            ))}
          </Card>
          {data.inquiries.length > 12 && (
            <button
              className="mt-2 text-sm text-sky-600 hover:underline"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "Weniger anzeigen"
                : `Alle ${data.inquiries.length} anzeigen`}
            </button>
          )}
        </div>
      )}

      {/* Schwache Segmente */}
      {(weakOccasions.length > 0 || weakBuckets.length > 0) && (
        <Card className="p-5 rounded-2xl">
          <h2 className="text-base font-medium mb-1 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-amber-500" />
            Schwache Segmente
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Diese Gruppen buchen unterdurchschnittlich — Ansatzpunkte für Angebot & Preis.
          </p>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
            {[...weakOccasions, ...weakBuckets].map((s) => (
              <div key={s.key} className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.bookedRate} % · {s.booked}/{s.inquiries}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default DiagnosticsSection;
