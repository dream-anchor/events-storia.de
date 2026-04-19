import { useEffect, useState } from "react";
import { CreditCard, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PaymentTerms {
  deposit_percent: number;
  deposit_due_days: number;
  offer_validity_days: number;
}

interface PaymentTermsBlockProps {
  depositPercent: number | null | undefined;
  depositDueDays: number | null | undefined;
  offerValidityDays: number | null | undefined;
  onChange: (field: keyof PaymentTerms, value: number) => void;
  isReadOnly?: boolean;
}

const DEFAULTS: PaymentTerms = {
  deposit_percent: 20,
  deposit_due_days: 5,
  offer_validity_days: 14,
};

/**
 * PaymentTermsBlock — Editor für Zahlungs-Konditionen.
 * Drei Zahlenfelder: Anzahlung %, Anzahlungs-Frist (Tage), Angebots-Gültigkeit (Tage).
 * Wenn deposit_percent === 0, wird das mittlere Feld ausgegraut.
 * Defaults werden aus site_settings.default_payment_terms geladen falls Felder leer.
 */
export function PaymentTermsBlock({
  depositPercent,
  depositDueDays,
  offerValidityDays,
  onChange,
  isReadOnly = false,
}: PaymentTermsBlockProps) {
  const [defaults, setDefaults] = useState<PaymentTerms>(DEFAULTS);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Defaults aus site_settings laden (einmalig)
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "default_payment_terms")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const v = data?.value as Partial<PaymentTerms> | null;
        if (v) {
          setDefaults({
            deposit_percent: v.deposit_percent ?? DEFAULTS.deposit_percent,
            deposit_due_days: v.deposit_due_days ?? DEFAULTS.deposit_due_days,
            offer_validity_days: v.offer_validity_days ?? DEFAULTS.offer_validity_days,
          });
        }
        setDefaultsLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Beim ersten Öffnen: wenn die Inquiry keine Werte hat, Defaults vorfüllen
  useEffect(() => {
    if (!defaultsLoaded || isReadOnly) return;
    if (depositPercent == null) onChange("deposit_percent", defaults.deposit_percent);
    if (depositDueDays == null) onChange("deposit_due_days", defaults.deposit_due_days);
    if (offerValidityDays == null) onChange("offer_validity_days", defaults.offer_validity_days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsLoaded]);

  const dp = depositPercent ?? defaults.deposit_percent;
  const dd = depositDueDays ?? defaults.deposit_due_days;
  const ov = offerValidityDays ?? defaults.offer_validity_days;
  const dueDisabled = dp === 0;

  const handleNumber = (field: keyof PaymentTerms, raw: string, min: number, max?: number) => {
    if (raw === "") return;
    let n = parseInt(raw, 10);
    if (isNaN(n)) return;
    if (n < min) n = min;
    if (max != null && n > max) n = max;
    onChange(field, n);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-4 w-4 text-primary/70" />
        <h3 className="text-sm font-semibold tracking-tight">Zahlungs-Konditionen</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="deposit-percent" className="text-xs text-muted-foreground">
            Anzahlung
          </Label>
          <div className="relative">
            <Input
              id="deposit-percent"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={dp}
              disabled={isReadOnly}
              onChange={(e) => handleNumber("deposit_percent", e.target.value, 0, 100)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="deposit-due-days"
            className={cn("text-xs", dueDisabled ? "text-muted-foreground/40" : "text-muted-foreground")}
          >
            Anzahlungs-Frist
          </Label>
          <div className="relative">
            <Input
              id="deposit-due-days"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={dd}
              disabled={isReadOnly || dueDisabled}
              onChange={(e) => handleNumber("deposit_due_days", e.target.value, 1)}
              className={cn("pr-12", dueDisabled && "opacity-50")}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="offer-validity" className="text-xs text-muted-foreground">
            Angebots-Gültigkeit
          </Label>
          <div className="relative">
            <Input
              id="offer-validity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={ov}
              disabled={isReadOnly}
              onChange={(e) => handleNumber("offer_validity_days", e.target.value, 1)}
              className="pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 mt-4 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <p>
          {dp === 0
            ? `Vollzahlung bei Auftragserteilung. Angebot ${ov} Tage gültig.`
            : dp === 100
              ? `Vorauszahlung 100 % innerhalb ${dd} Tage. Angebot ${ov} Tage gültig.`
              : `Anzahlung ${dp} % innerhalb ${dd} Tage, Restzahlung vor Veranstaltung. Angebot ${ov} Tage gültig.`}
        </p>
      </div>
    </div>
  );
}
