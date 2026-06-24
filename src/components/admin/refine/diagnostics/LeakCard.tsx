import { Card } from "@/components/ui/card";
import {
  Inbox, Clock, Mail, Snowflake, Euro, Calendar, HelpCircle, ArrowRight,
} from "lucide-react";
import { formatEur } from "@/lib/utils";
import type { Leak, FindingKey } from "@/hooks/useInquiryDiagnostics";

const ICONS: Record<FindingKey, React.ComponentType<{ className?: string }>> = {
  never_answered: Inbox,
  too_slow: Clock,
  offer_unopened: Mail,
  went_cold: Snowflake,
  price: Euro,
  date: Calendar,
  plan_cancelled: HelpCircle,
  not_qualified: HelpCircle,
  other: HelpCircle,
};

// Akzentfarbe je Befund (Tailwind-Klassen für Icon-Kachel).
const TONE: Record<FindingKey, string> = {
  never_answered: "bg-red-500/10 text-red-600",
  too_slow: "bg-amber-500/10 text-amber-600",
  offer_unopened: "bg-red-500/10 text-red-600",
  went_cold: "bg-sky-500/10 text-sky-600",
  price: "bg-muted text-muted-foreground",
  date: "bg-muted text-muted-foreground",
  plan_cancelled: "bg-muted text-muted-foreground",
  not_qualified: "bg-muted text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

export function LeakCard({ leak }: { leak: Leak }) {
  const Icon = ICONS[leak.key];
  const lossLabel =
    leak.totalCents > 0
      ? leak.estimatedCents > 0 && leak.securedCents > 0
        ? `${formatEur(leak.securedCents)} gesichert · bis ${formatEur(leak.totalCents)}`
        : leak.estimatedCents > 0
          ? `~${formatEur(leak.totalCents)} geschätzt`
          : `${formatEur(leak.totalCents)} verloren`
      : null;

  return (
    <Card className="p-4 md:p-5 rounded-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${TONE[leak.key]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px] font-medium">{leak.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
            {leak.count} {leak.count === 1 ? "Anfrage" : "Anfragen"}
            {leak.openCount > 0 ? ` · ${leak.openCount} offen` : ""}
          </span>
          {lossLabel && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700">
              {lossLabel}
            </span>
          )}
        </div>
      </div>

      {leak.detail && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{leak.detail}</p>
      )}

      <div className="mt-3 text-sm leading-relaxed flex gap-2 items-start bg-muted/50 rounded-lg px-3 py-2">
        <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-sky-600" />
        <span>
          <span className="font-medium">Empfehlung:</span> {leak.recommendation}
        </span>
      </div>
    </Card>
  );
}

export default LeakCard;
