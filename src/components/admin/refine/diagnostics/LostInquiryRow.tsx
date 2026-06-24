import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LOSS_REASON_LABELS } from "@/hooks/useConversionData";
import {
  OCCASION_LABELS, type InquiryDiagnosis, type FindingKey,
} from "@/hooks/useInquiryDiagnostics";
import { formatEur } from "@/lib/utils";

// Farbpunkt = Schweregrad des Befunds.
const DOT: Record<FindingKey, string> = {
  never_answered: "bg-red-500",
  offer_unopened: "bg-red-500",
  too_slow: "bg-amber-500",
  went_cold: "bg-sky-500",
  price: "bg-slate-400",
  date: "bg-slate-400",
  plan_cancelled: "bg-slate-300",
  not_qualified: "bg-slate-300",
  other: "bg-slate-400",
};

export function LostInquiryRow({
  d, onSetLossReason,
}: {
  d: InquiryDiagnosis;
  onSetLossReason: (id: string, reason: string) => void;
}) {
  const meta: string[] = [];
  if (d.occasion) meta.push(OCCASION_LABELS[d.occasion] || d.occasion);
  if (d.guestCount) meta.push(`${d.guestCount} Gäste`);
  if (d.valueCents > 0) meta.push(`${d.valueEstimated ? "~" : ""}${formatEur(d.valueCents)}`);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0">
      <span className={`h-2 w-2 rounded-full shrink-0 ${DOT[d.finding]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground truncate">
          {d.label}
          {meta.length > 0 && (
            <span className="text-muted-foreground"> · {meta.join(" · ")}</span>
          )}
          {d.isOpen && (
            <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700">
              noch offen
            </span>
          )}
        </div>
        <div className="text-[13px] text-muted-foreground truncate">{d.findingText}</div>
      </div>

      {!d.hasLossReason ? (
        <Select onValueChange={(v) => onSetLossReason(d.id, v)}>
          <SelectTrigger className="w-40 h-8 rounded-lg shrink-0">
            <SelectValue placeholder="Grund nachtragen…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LOSS_REASON_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
          {d.ageDays} T
        </span>
      )}
    </div>
  );
}

export default LostInquiryRow;
