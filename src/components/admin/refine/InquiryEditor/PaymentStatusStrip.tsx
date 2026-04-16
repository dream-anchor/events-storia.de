import { useEffect, useState } from "react";
import { CreditCard, Plus, Check, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PaymentStatusStripProps {
  inquiryId: string;
  onNavigateToDetails: () => void;
}

interface PaymentSummary {
  count: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  overdueCents: number;
  hasLinks: boolean;
}

/**
 * Kompakter Payment-Status für den Angebot-Tab.
 * Zeigt eine Zeile mit: "Keine Zahlungen" oder "500€ bezahlt / 1200€ offen"
 * Klick navigiert zum Details-Tab für volle PaymentCard.
 */
export function PaymentStatusStrip({ inquiryId, onNavigateToDetails }: PaymentStatusStripProps) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('event_payments')
        .select('amount_cents, status, stripe_payment_link_url, due_date, paid_at')
        .eq('inquiry_id', inquiryId);

      if (!mounted) return;

      if (!data || data.length === 0) {
        setSummary({ count: 0, totalCents: 0, paidCents: 0, openCents: 0, overdueCents: 0, hasLinks: false });
        setLoading(false);
        return;
      }

      let totalCents = 0, paidCents = 0, openCents = 0, overdueCents = 0;
      let hasLinks = false;
      for (const p of data) {
        const amt = p.amount_cents || 0;
        totalCents += amt;
        if (p.stripe_payment_link_url) hasLinks = true;
        const status = (p.computed_status || p.status) as string;
        if (status === 'paid') paidCents += amt;
        else if (status === 'overdue') overdueCents += amt;
        else openCents += amt;
      }

      setSummary({ count: data.length, totalCents, paidCents, openCents, overdueCents, hasLinks });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [inquiryId]);

  const formatEur = (cents: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(cents / 100);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5 shrink-0" />
        <span>Zahlungen werden geladen...</span>
      </div>
    );
  }

  if (!summary) return null;

  // Keine Zahlungen konfiguriert
  if (summary.count === 0) {
    return (
      <button
        onClick={onNavigateToDetails}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/30 transition-colors text-left"
      >
        <CreditCard className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Noch keine Zahlungen konfiguriert</span>
        <span className="flex items-center gap-1 text-primary">
          <Plus className="h-3 w-3" />
          Anlegen
        </span>
      </button>
    );
  }

  // Alles bezahlt
  if (summary.paidCents === summary.totalCents) {
    return (
      <button
        onClick={onNavigateToDetails}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs hover:bg-emerald-100/60 transition-colors text-left"
      >
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span className="flex-1 text-emerald-700 dark:text-emerald-300 font-medium">
          Vollständig bezahlt · {formatEur(summary.totalCents)}
        </span>
        <span className="text-emerald-600/70 text-[11px]">{summary.count} {summary.count === 1 ? 'Zahlung' : 'Zahlungen'}</span>
      </button>
    );
  }

  // Überfällig
  if (summary.overdueCents > 0) {
    return (
      <button
        onClick={onNavigateToDetails}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 text-xs hover:bg-red-100/60 transition-colors text-left"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
        <span className="flex-1 text-red-700 dark:text-red-300 font-medium">
          {formatEur(summary.overdueCents)} überfällig
        </span>
        <span className="text-red-600/70 text-[11px]">Details öffnen</span>
      </button>
    );
  }

  // Teilweise bezahlt / offen
  return (
    <button
      onClick={onNavigateToDetails}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs hover:bg-muted/30 transition-colors text-left",
        summary.paidCents > 0
          ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40"
          : "bg-muted/20 border-border/60"
      )}
    >
      <CreditCard className={cn("h-3.5 w-3.5 shrink-0", summary.paidCents > 0 ? "text-amber-600" : "text-muted-foreground")} />
      <span className="flex-1">
        {summary.paidCents > 0 && (
          <>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">{formatEur(summary.paidCents)} bezahlt</span>
            <span className="text-muted-foreground"> · </span>
          </>
        )}
        <span className="font-medium">{formatEur(summary.openCents)} offen</span>
        {summary.hasLinks && (
          <span className="text-muted-foreground"> · Zahlungslinks aktiv</span>
        )}
      </span>
      <span className="text-muted-foreground text-[11px]">
        {summary.count} {summary.count === 1 ? 'Zahlung' : 'Zahlungen'}
      </span>
    </button>
  );
}
