import { useEffect, useState, useCallback } from "react";
import { CreditCard, Info, Landmark, Receipt, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type PaymentMethodType = 'deposit_online' | 'prepayment_online' | 'on_site' | 'invoice_after';

interface PaymentTermsBlockProps {
  depositPercent: number | null | undefined;
  depositAmount: number | null | undefined;
  depositDueDays: number | null | undefined;
  offerValidityDays: number | null | undefined;
  paymentMethod: string | null | undefined;
  invoiceDueDays: number | null | undefined;
  onChange: (field: string, value: number | string) => void;
  isReadOnly?: boolean;
}

const DEFAULTS = {
  deposit_percent: 20 as number,
  deposit_due_days: 5 as number,
  offer_validity_days: 14 as number,
  invoice_due_days: 14 as number,
};

const PAYMENT_METHODS: {
  value: PaymentMethodType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'deposit_online',
    label: 'Anzahlung + Online',
    description: 'Teilzahlung vorab per Stripe',
    icon: CreditCard,
  },
  {
    value: 'prepayment_online',
    label: 'Vorauszahlung',
    description: '100 % vorab per Stripe',
    icon: Wallet,
  },
  {
    value: 'on_site',
    label: 'Vor Ort',
    description: 'Zahlung beim Event',
    icon: Landmark,
  },
  {
    value: 'invoice_after',
    label: 'Rechnung',
    description: 'Zahlung nach dem Event',
    icon: Receipt,
  },
];

/**
 * PaymentTermsBlock — Editor für Zahlungs-Konditionen.
 * 4 Zahlungsarten + kontextabhängige Detail-Felder.
 */
export function PaymentTermsBlock({
  depositPercent,
  depositAmount,
  depositDueDays,
  offerValidityDays,
  paymentMethod,
  invoiceDueDays,
  onChange,
  isReadOnly = false,
}: PaymentTermsBlockProps) {
  const [defaults, setDefaults] = useState(DEFAULTS);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const method = (paymentMethod || 'deposit_online') as PaymentMethodType;

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
        const v = data?.value as Record<string, number> | null;
        if (v) {
          setDefaults({
            deposit_percent: v.deposit_percent ?? DEFAULTS.deposit_percent,
            deposit_due_days: v.deposit_due_days ?? DEFAULTS.deposit_due_days,
            offer_validity_days: v.offer_validity_days ?? DEFAULTS.offer_validity_days,
            invoice_due_days: v.invoice_due_days ?? DEFAULTS.invoice_due_days,
          });
        }
        setDefaultsLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Beim ersten Öffnen: wenn die Inquiry keine Werte hat, Defaults vorfüllen
  useEffect(() => {
    if (!defaultsLoaded || isReadOnly) return;
    if (paymentMethod == null) onChange("payment_method", "deposit_online");
    if (depositPercent == null) onChange("deposit_percent", defaults.deposit_percent);
    if (depositDueDays == null) onChange("deposit_due_days", defaults.deposit_due_days);
    if (offerValidityDays == null) onChange("offer_validity_days", defaults.offer_validity_days);
    if (invoiceDueDays == null) onChange("invoice_due_days", defaults.invoice_due_days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsLoaded]);

  const dp = depositPercent ?? defaults.deposit_percent;
  const dd = depositDueDays ?? defaults.deposit_due_days;
  const ov = offerValidityDays ?? defaults.offer_validity_days;
  const invDays = invoiceDueDays ?? defaults.invoice_due_days;

  // Anzahlungs-Modus: 'percent' (Default) oder 'amount' (fester Eurobetrag)
  const depositMode: 'percent' | 'amount' = depositAmount != null && depositAmount > 0 ? 'amount' : 'percent';
  const da = depositAmount ?? 0;

  const handleNumber = useCallback((field: string, raw: string, min: number, max?: number) => {
    if (raw === "") return;
    let n = parseInt(raw, 10);
    if (isNaN(n)) return;
    if (n < min) n = min;
    if (max != null && n > max) n = max;
    onChange(field, n);
  }, [onChange]);

  const handleMethodChange = useCallback((m: PaymentMethodType) => {
    if (isReadOnly) return;
    onChange("payment_method", m);
    // Auto-set deposit_percent based on method
    if (m === 'prepayment_online') {
      onChange("deposit_percent", 100);
      onChange("deposit_amount", 0);
    } else if (m === 'deposit_online' && dp === 100) {
      onChange("deposit_percent", defaults.deposit_percent);
    }
  }, [isReadOnly, onChange, dp, defaults.deposit_percent]);

  const handleDepositModeChange = useCallback((mode: 'percent' | 'amount') => {
    if (isReadOnly) return;
    if (mode === 'percent') {
      onChange("deposit_amount", 0);
      if (depositPercent == null || depositPercent === 0) {
        onChange("deposit_percent", defaults.deposit_percent);
      }
    } else {
      onChange("deposit_percent", 0);
      if (depositAmount == null || depositAmount === 0) {
        onChange("deposit_amount", 100);
      }
    }
  }, [isReadOnly, onChange, depositPercent, depositAmount, defaults.deposit_percent]);

  // Welche Felder je nach Methode sichtbar?
  const showDeposit = method === 'deposit_online';
  const showDepositFrist = method === 'deposit_online' || method === 'prepayment_online';
  const showInvoiceDays = method === 'invoice_after';

  // Summary text
  const summaryText = (() => {
    switch (method) {
      case 'deposit_online':
        return depositMode === 'amount'
          ? `Anzahlung ${da.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € innerhalb ${dd} Tage, Restzahlung vor Veranstaltung. Angebot ${ov} Tage gültig.`
          : `Anzahlung ${dp} % innerhalb ${dd} Tage, Restzahlung vor Veranstaltung. Angebot ${ov} Tage gültig.`;
      case 'prepayment_online':
        return `Vorauszahlung 100 % innerhalb ${dd} Tage per Stripe. Angebot ${ov} Tage gültig.`;
      case 'on_site':
        return `Zahlung vor Ort beim Event. Angebot ${ov} Tage gültig.`;
      case 'invoice_after':
        return `Rechnung nach dem Event, zahlbar innerhalb ${invDays} Tage. Angebot ${ov} Tage gültig.`;
      default:
        return `Angebot ${ov} Tage gültig.`;
    }
  })();

  return (
    <div className="rounded-2xl border border-border/60 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-4 w-4 text-primary/70" />
        <h3 className="text-sm font-semibold tracking-tight">Zahlungs-Konditionen</h3>
      </div>

      {/* Zahlungsart-Kacheln */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {PAYMENT_METHODS.map(({ value, label, description, icon: Icon }) => {
          const selected = method === value;
          return (
            <button
              key={value}
              type="button"
              disabled={isReadOnly}
              onClick={() => handleMethodChange(value)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
                "hover:border-primary/40",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/50 bg-background",
                isReadOnly && "opacity-60 cursor-not-allowed"
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0">
                <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>{label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Kontextabhängige Detail-Felder */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {showDeposit && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="deposit-value" className="text-xs text-muted-foreground">
                Anzahlung
              </Label>
              <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5">
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => handleDepositModeChange('percent')}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors",
                    depositMode === 'percent' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  %
                </button>
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => handleDepositModeChange('amount')}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors",
                    depositMode === 'amount' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  €
                </button>
              </div>
            </div>
            {depositMode === 'percent' ? (
              <div className="relative">
                <Input
                  id="deposit-value"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  step={1}
                  value={dp}
                  disabled={isReadOnly}
                  onChange={(e) => handleNumber("deposit_percent", e.target.value, 1, 99)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="deposit-value"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={1}
                  value={da || ''}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') return;
                    const n = parseFloat(raw.replace(',', '.'));
                    if (isNaN(n) || n < 0) return;
                    onChange("deposit_amount", n);
                  }}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
              </div>
            )}
          </div>
        )}

        {showDepositFrist && (
          <div className="space-y-1.5">
            <Label htmlFor="deposit-due-days" className="text-xs text-muted-foreground">
              {method === 'prepayment_online' ? 'Zahlungsfrist' : 'Anzahlungs-Frist'}
            </Label>
            <div className="relative">
              <Input
                id="deposit-due-days"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={dd}
                disabled={isReadOnly}
                onChange={(e) => handleNumber("deposit_due_days", e.target.value, 1)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
            </div>
          </div>
        )}

        {showInvoiceDays && (
          <div className="space-y-1.5">
            <Label htmlFor="invoice-due-days" className="text-xs text-muted-foreground">
              Zahlungsfrist
            </Label>
            <div className="relative">
              <Input
                id="invoice-due-days"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={invDays}
                disabled={isReadOnly}
                onChange={(e) => handleNumber("invoice_due_days", e.target.value, 1)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
            </div>
          </div>
        )}

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
        <p>{summaryText}</p>
      </div>
    </div>
  );
}
