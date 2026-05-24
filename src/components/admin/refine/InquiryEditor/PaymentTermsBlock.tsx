import { useEffect, useState, useCallback } from "react";
import { Ban, CreditCard, FileText, Info, Landmark, Receipt, ShieldCheck, Wallet, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type DepositMethod = 'none' | 'stripe' | 'on_site' | 'invoice';
export type BalanceMethod = 'stripe_prepay' | 'on_site' | 'invoice_after';
export type PaymentMethodType = 'deposit_online' | 'prepayment_online' | 'on_site' | 'invoice_after';

interface PaymentTermsBlockProps {
  depositPercent: number | null | undefined;
  depositAmount: number | null | undefined;
  depositDueDays: number | null | undefined;
  offerValidityDays: number | null | undefined;
  paymentMethod: string | null | undefined;
  invoiceDueDays: number | null | undefined;
  depositMethod?: DepositMethod | string | null;
  balanceMethod?: BalanceMethod | string | null;
  balanceDueDaysBeforeEvent?: number | null;
  onChange: (field: string, value: number | string | null) => void;
  isReadOnly?: boolean;
}

const DEFAULTS = {
  deposit_percent: 20,
  deposit_due_days: 5,
  offer_validity_days: 14,
  invoice_due_days: 14,
  balance_due_days_before_event: 14,
};

const DEPOSIT_OPTIONS: { value: DepositMethod; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'none',    label: 'Keine Anzahlung',  description: 'Nur Restbetrag',          icon: Ban },
  { value: 'stripe',  label: 'Stripe – sofort',  description: 'Online-Zahlung per Link', icon: CreditCard },
  { value: 'on_site', label: 'Vor Ort',          description: 'Bar / EC am Event',       icon: Landmark },
  { value: 'invoice', label: 'Rechnung vorab',   description: 'Per Überweisung',         icon: FileText },
];

const BALANCE_OPTIONS: { value: BalanceMethod; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'stripe_prepay', label: 'Stripe – vorab',      description: 'Link in Mail vor Event', icon: Wallet },
  { value: 'on_site',       label: 'Vor Ort beim Event',  description: 'Bar / EC am Event',      icon: Landmark },
  { value: 'invoice_after', label: 'Rechnung nach Event', description: 'Per Überweisung',        icon: Receipt },
];

function legacyToPair(pm: string | null | undefined): { deposit: DepositMethod; balance: BalanceMethod } {
  switch (pm) {
    case 'deposit_online':    return { deposit: 'stripe', balance: 'stripe_prepay' };
    case 'prepayment_online': return { deposit: 'none',   balance: 'stripe_prepay' };
    case 'on_site':           return { deposit: 'none',   balance: 'on_site' };
    case 'invoice_after':     return { deposit: 'none',   balance: 'invoice_after' };
    default:                  return { deposit: 'stripe', balance: 'stripe_prepay' };
  }
}

function pairToLegacy(deposit: DepositMethod, balance: BalanceMethod): PaymentMethodType {
  if (deposit === 'stripe' && balance === 'stripe_prepay') return 'deposit_online';
  if (deposit === 'none'   && balance === 'stripe_prepay') return 'prepayment_online';
  if (balance === 'on_site') return 'on_site';
  if (balance === 'invoice_after') return 'invoice_after';
  return 'deposit_online';
}

export function PaymentTermsBlock({
  depositPercent, depositAmount, depositDueDays, offerValidityDays, paymentMethod, invoiceDueDays,
  depositMethod, balanceMethod, balanceDueDaysBeforeEvent, onChange, isReadOnly = false,
}: PaymentTermsBlockProps) {
  const [defaults, setDefaults] = useState(DEFAULTS);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const legacyPair = legacyToPair(paymentMethod);
  const dMethod: DepositMethod = (depositMethod ?? legacyPair.deposit) as DepositMethod;
  const bMethod: BalanceMethod = (balanceMethod ?? legacyPair.balance) as BalanceMethod;

  useEffect(() => {
    let cancelled = false;
    supabase.from("site_settings").select("value").eq("key", "default_payment_terms").maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const v = data?.value as Record<string, number> | null;
        if (v) {
          setDefaults({
            deposit_percent: v.deposit_percent ?? DEFAULTS.deposit_percent,
            deposit_due_days: v.deposit_due_days ?? DEFAULTS.deposit_due_days,
            offer_validity_days: v.offer_validity_days ?? DEFAULTS.offer_validity_days,
            invoice_due_days: v.invoice_due_days ?? DEFAULTS.invoice_due_days,
            balance_due_days_before_event: v.balance_due_days_before_event ?? DEFAULTS.balance_due_days_before_event,
          });
        }
        setDefaultsLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!defaultsLoaded || isReadOnly) return;
    if (paymentMethod == null) onChange("payment_method", "deposit_online");
    if (depositMethod == null) onChange("deposit_method", "stripe");
    if (balanceMethod == null) onChange("balance_method", "stripe_prepay");
    if (depositPercent == null) onChange("deposit_percent", defaults.deposit_percent);
    if (depositDueDays == null) onChange("deposit_due_days", defaults.deposit_due_days);
    if (offerValidityDays == null) onChange("offer_validity_days", defaults.offer_validity_days);
    if (invoiceDueDays == null) onChange("invoice_due_days", defaults.invoice_due_days);
    if (balanceDueDaysBeforeEvent == null) onChange("balance_due_days_before_event", defaults.balance_due_days_before_event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsLoaded]);

  const dp = depositPercent ?? defaults.deposit_percent;
  const dd = depositDueDays ?? defaults.deposit_due_days;
  const ov = offerValidityDays ?? defaults.offer_validity_days;
  const invDays = invoiceDueDays ?? defaults.invoice_due_days;
  const bDays = balanceDueDaysBeforeEvent ?? defaults.balance_due_days_before_event;
  const depositMode: 'percent' | 'amount' = depositAmount != null && depositAmount > 0 ? 'amount' : 'percent';
  const da = depositAmount ?? 0;

  const handleNumber = useCallback((field: string, raw: string, min: number, max?: number) => {
    if (raw === "") { onChange(field, min); return; }
    let n = parseInt(raw, 10);
    if (isNaN(n)) return;
    if (n < min) n = min;
    if (max != null && n > max) n = max;
    onChange(field, n);
  }, [onChange]);

  const setPair = useCallback((deposit: DepositMethod, balance: BalanceMethod) => {
    if (isReadOnly) return;
    onChange("deposit_method", deposit);
    onChange("balance_method", balance);
    onChange("payment_method", pairToLegacy(deposit, balance));
    onChange("payment_timing",
      balance === 'on_site' ? 'on_site'
      : balance === 'invoice_after' ? 'after_event'
      : deposit === 'none' ? 'online_full'
      : 'online_deposit');
    if (deposit === 'none') {
      onChange("deposit_percent", balance === 'stripe_prepay' ? 100 : 0);
      onChange("deposit_amount", 0);
    } else if (dp === 0 || dp === 100) {
      onChange("deposit_percent", defaults.deposit_percent);
    }
  }, [isReadOnly, onChange, dp, defaults.deposit_percent]);

  const handleDepositModeChange = useCallback((mode: 'percent' | 'amount') => {
    if (isReadOnly) return;
    if (mode === 'percent') {
      onChange("deposit_amount", 0);
      if (depositPercent == null || depositPercent === 0) onChange("deposit_percent", defaults.deposit_percent);
    } else {
      onChange("deposit_percent", 0);
      if (depositAmount == null || depositAmount === 0) onChange("deposit_amount", 100);
    }
  }, [isReadOnly, onChange, depositPercent, depositAmount, defaults.deposit_percent]);

  const showDepositAmount = dMethod !== 'none';
  const showDepositFrist  = dMethod === 'stripe' || dMethod === 'invoice';
  const showBalanceFrist  = bMethod === 'stripe_prepay';
  const showInvoiceDays   = bMethod === 'invoice_after';
  const hasAnyStripe = dMethod === 'stripe' || bMethod === 'stripe_prepay';

  const depositText = dMethod === 'none' ? null : (() => {
    const amountStr = depositMode === 'amount'
      ? `${da.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : `${dp} %`;
    const channel = dMethod === 'stripe' ? 'per Stripe' : dMethod === 'on_site' ? 'vor Ort' : 'per Rechnung';
    const frist = showDepositFrist ? ` innerhalb ${dd} Tage` : '';
    return `Anzahlung ${amountStr} ${channel}${frist}`;
  })();
  const balanceText = bMethod === 'stripe_prepay'
    ? `Restzahlung per Stripe (${bDays} Tage vor Event)`
    : bMethod === 'on_site'
    ? `Restzahlung vor Ort beim Event`
    : `Restzahlung per Rechnung nach Event (Zahlungsziel ${invDays} Tage)`;
  const summaryText = `${depositText ? depositText + ', ' : ''}${balanceText}. Angebot ${ov} Tage gültig.`;

  return (
    <div className="rounded-2xl border border-border/60 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-4 w-4 text-primary/70" />
        <h3 className="text-sm font-semibold tracking-tight">Zahlungs-Konditionen</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Anzahlung</div>
          <div className="grid grid-cols-1 gap-2">
            {DEPOSIT_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const selected = dMethod === value;
              return (
                <button key={value} type="button" disabled={isReadOnly}
                  onClick={() => setPair(value, bMethod)}
                  className={cn("flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all hover:border-primary/40",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-background",
                    isReadOnly && "opacity-60 cursor-not-allowed")}>
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>{label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Restzahlung</div>
          <div className="grid grid-cols-1 gap-2">
            {BALANCE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const selected = bMethod === value;
              return (
                <button key={value} type="button" disabled={isReadOnly}
                  onClick={() => setPair(dMethod, value)}
                  className={cn("flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all hover:border-primary/40",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-background",
                    isReadOnly && "opacity-60 cursor-not-allowed")}>
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>{label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {showDepositAmount && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="deposit-value" className="text-xs text-muted-foreground">Anzahlung</Label>
              <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5">
                <button type="button" disabled={isReadOnly} onClick={() => handleDepositModeChange('percent')}
                  className={cn("px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors",
                    depositMode === 'percent' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>%</button>
                <button type="button" disabled={isReadOnly} onClick={() => handleDepositModeChange('amount')}
                  className={cn("px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors",
                    depositMode === 'amount' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>€</button>
              </div>
            </div>
            {depositMode === 'percent' ? (
              <div className="relative">
                <Input id="deposit-value" type="number" inputMode="numeric" min={0} max={99} step={1}
                  value={dp} disabled={isReadOnly}
                  onChange={(e) => handleNumber("deposit_percent", e.target.value, 0, 99)} className="pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            ) : (
              <div className="relative">
                <Input id="deposit-value" type="number" inputMode="decimal" min={1} step={1}
                  value={da || ''} disabled={isReadOnly}
                  onChange={(e) => {
                    const raw = e.target.value; if (raw === '') return;
                    const n = parseFloat(raw.replace(',', '.'));
                    if (isNaN(n) || n < 0) return;
                    onChange("deposit_amount", n);
                  }} className="pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
              </div>
            )}
          </div>
        )}

        {showDepositFrist && (
          <div className="space-y-1.5">
            <Label htmlFor="deposit-due-days" className="text-xs text-muted-foreground">Anzahlungs-Frist</Label>
            <div className="relative">
              <Input id="deposit-due-days" type="number" inputMode="numeric" min={1} step={1}
                value={dd} disabled={isReadOnly}
                onChange={(e) => handleNumber("deposit_due_days", e.target.value, 1)} className="pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
            </div>
          </div>
        )}

        {showBalanceFrist && (
          <div className="space-y-1.5">
            <Label htmlFor="balance-due-days" className="text-xs text-muted-foreground">Restzahlung-Frist (vor Event)</Label>
            <div className="relative">
              <Input id="balance-due-days" type="number" inputMode="numeric" min={1} step={1}
                value={bDays} disabled={isReadOnly}
                onChange={(e) => handleNumber("balance_due_days_before_event", e.target.value, 1)} className="pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
            </div>
          </div>
        )}

        {showInvoiceDays && (
          <div className="space-y-1.5">
            <Label htmlFor="invoice-due-days" className="text-xs text-muted-foreground">Zahlungsfrist (nach Event)</Label>
            <div className="relative">
              <Input id="invoice-due-days" type="number" inputMode="numeric" min={1} step={1}
                value={invDays} disabled={isReadOnly}
                onChange={(e) => handleNumber("invoice_due_days", e.target.value, 1)} className="pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="offer-validity" className="text-xs text-muted-foreground">Angebots-Gültigkeit</Label>
          <div className="relative">
            <Input id="offer-validity" type="number" inputMode="numeric" min={1} step={1}
              value={ov} disabled={isReadOnly}
              onChange={(e) => handleNumber("offer_validity_days", e.target.value, 1)} className="pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Tage</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 mt-4 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <p>{summaryText}</p>
      </div>

      {!hasAnyStripe ? (
        <div className="mt-3 rounded-xl border border-neutral-300/70 bg-neutral-50 p-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-neutral-700" />
          <div className="text-[11px] leading-relaxed text-neutral-700">
            <strong className="text-neutral-900">Kunde sieht:</strong> Button „Verbindlich buchen" mit
            rechtswirksamer Auftragsbestätigung (3 Checkboxen, Name, IP, Geräte-Nachweis). Vertragsschluss nach §§145, 147 BGB.
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 flex items-start gap-2.5">
          <Zap className="h-4 w-4 mt-0.5 shrink-0 text-neutral-600" />
          <div className="text-[11px] leading-relaxed text-neutral-600">
            <strong className="text-neutral-900">Kunde sieht:</strong>{' '}
            {dMethod === 'stripe'
              ? 'Stripe-Buchen-Button für die Anzahlung — Vertragsschluss erfolgt automatisch mit der Zahlung.'
              : 'Stripe-Link wird automatisch für die Restzahlung versendet.'}
            {bMethod === 'stripe_prepay' && <> 7 Tage vor Event automatische Erinnerung, falls der Restbetrag noch offen ist.</>}
          </div>
        </div>
      )}
    </div>
  );
}