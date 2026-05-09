import { useState } from "react";
import {
  UtensilsCrossed,
  Wine,
  CreditCard,
  Users,
  Loader2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PublicInquiry, PublicOfferOption } from "./types";
import { formatCurrency, formatCurrencyDecimal, buildDrinkRows } from "./types";
import { CancellationTermsAccordion } from "./ContactSection";

export function FinalOfferView({
  inquiry,
  options,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}) {
  const selectedId = inquiry.selected_option_id;
  const displayOptions = selectedId
    ? options.filter((o) => o.id === selectedId)
    : options;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-4xl">
          <div className="mb-10">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
              Finales Angebot
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold">
              {displayOptions.length === 1 ? "Ihr Menü" : `${displayOptions.length} Optionen`}
            </h2>
          </div>

          <div className={cn(
            "gap-6",
            displayOptions.length > 1
              ? "grid grid-cols-1 lg:grid-cols-2"
              : "max-w-2xl"
          )}>
            {displayOptions.map((option) => (
              <FinalOptionCard
                key={option.id}
                option={option}
                inquiryId={inquiry.id}
                isSelected={inquiry.selected_option_id === option.id}
                singleOption={displayOptions.length === 1}
                paymentMethod={inquiry.payment_method || 'deposit_online'}
                invoiceDueDays={inquiry.invoice_due_days ?? 14}
                depositPercent={inquiry.deposit_percent ?? 20}
                depositAmount={inquiry.deposit_amount ?? null}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalOptionCard({
  option,
  inquiryId,
  isSelected,
  singleOption,
  paymentMethod,
  invoiceDueDays,
}: {
  option: PublicOfferOption;
  inquiryId: string;
  isSelected: boolean;
  singleOption: boolean;
  paymentMethod: string;
  invoiceDueDays: number;
}) {
  const isStripePayment = paymentMethod === 'deposit_online' || paymentMethod === 'prepayment_online';
  const [isRedirecting, setIsRedirecting] = useState(false);
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinkRows = buildDrinkRows(menu);
  const isPerEvent = menu?.pricingMode === 'per_event';
  const pricePerPerson = isPerEvent
    ? 0
    : option.guest_count > 0
      ? (menu?.budgetPerPerson && menu.budgetPerPerson > 0
          ? menu.budgetPerPerson
          : option.total_amount / option.guest_count)
      : 0;

  const totalAmount = option.total_amount;
  const depositPercent = 20;
  const depositAmount = Math.round(totalAmount * depositPercent) / 100;

  const handlePayment = async (paymentType: 'full' | 'deposit') => {
    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-session', {
        body: { inquiryId, optionId: option.id, paymentType },
      });
      if (error || !data?.checkoutUrl) {
        throw new Error(data?.error || 'Fehler beim Erstellen der Zahlungssitzung');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setIsRedirecting(false);
      toast.error(
        err instanceof Error ? err.message : 'Fehler bei der Zahlung',
        {
          description: 'Bitte versuchen Sie es erneut oder kontaktieren Sie uns unter 089 51519696.',
          duration: 6000,
        }
      );
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden transition-all",
        "bg-white/70 dark:bg-white/10 backdrop-blur-sm border",
        "shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
        isSelected
          ? "border-primary/40 ring-1 ring-primary/10"
          : "border-white/50 dark:border-white/20",
        singleOption && "max-w-2xl"
      )}
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {!singleOption && (
            <span className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold font-sans shrink-0 mt-0.5">
              {option.option_label}
            </span>
          )}
          <div>
            <h3 className="font-serif text-xl font-bold text-foreground">
              {option.offer_mode === "menu" || option.package_name === "Individuelles Paket" || option.package_name === "Individuelles Menü"
                ? "Individuelles Menü"
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} Gäste
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-serif font-bold text-primary leading-none">
            {pricePerPerson > 0
              ? formatCurrencyDecimal(pricePerPerson)
              : formatCurrency(option.total_amount)}
          </p>
          <p className="text-[11px] text-muted-foreground font-sans mt-1">
            {pricePerPerson > 0 ? 'pro Person' : 'Gesamtpreis'}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-sans mt-0.5">
            inkl. gesetzl. MwSt.
          </p>
        </div>
      </div>

      {/* Menü */}
      <div className="px-6 pb-6">
        {courses.length > 0 && (
          <div className="border-t border-border/20 pt-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary/40" />
              <h4 className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Menü
              </h4>
            </div>
            <div className="space-y-4">
              {courses.map((course, i) => (
                <div key={i}>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-1">
                    {course.courseLabel}
                  </p>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-base text-foreground">
                      {(course.quantity ?? 1) > 1 ? `${course.quantity} × ${course.itemName}` : course.itemName}
                    </p>
                    {option.offer_mode === 'paket' && course.overridePrice != null && course.overridePrice > 0 && (
                      <span className="text-xs font-sans text-muted-foreground tabular-nums shrink-0">
                        + {formatCurrencyDecimal(course.overridePrice)}
                      </span>
                    )}
                  </div>
                  {course.itemDescription && (
                    <p className="text-xs font-sans text-muted-foreground/60 italic mt-0.5">
                      {course.itemDescription}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {drinkRows.length > 0 && (
          <div className={cn("border-t border-border/20 pt-5", courses.length === 0 && "mt-0")}>
            <div className="flex items-center gap-2 mb-4">
              <Wine className="h-3.5 w-3.5 text-primary/40" />
              <h4 className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Getränke
              </h4>
            </div>
            <div className="space-y-3">
              {drinkRows.map((drink, i) => (
                <div key={i}>
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/40 mb-0.5">
                    {drink.label}
                  </p>
                  <div>
                    <p className="font-serif text-sm text-foreground">
                      {drink.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equipment */}
        {menu?.equipment && menu.equipment.filter(e => e.name).length > 0 && (
          <div className="border-t border-border/20 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-3.5 w-3.5 text-primary/50" />
              <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Equipment
              </span>
            </div>
            <div className="space-y-3">
              {menu.equipment.filter(e => e.name).map((eq, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <p className="font-serif text-sm text-foreground flex-1">
                    {eq.quantity > 1 ? `${eq.quantity} × ${eq.name}` : eq.name}
                  </p>
                  {eq.pricePerUnit > 0 && (
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                      {(eq.pricePerUnit * eq.quantity).toFixed(2)} €
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal */}
        {menu?.staff && menu.staff.filter(s => s.name).length > 0 && (
          <div className="border-t border-border/20 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-3.5 w-3.5 text-primary/50" />
              <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/50">
                Personal
              </span>
            </div>
            <div className="space-y-3">
              {menu.staff.filter(s => s.name).map((st, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2">
                  <p className="font-serif text-sm text-foreground flex-1">
                    {st.quantity > 1 ? `${st.quantity} × ${st.name}` : st.name}
                  </p>
                  {st.pricePerUnit > 0 && (
                    <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                      {(st.pricePerUnit * st.quantity).toFixed(2)} €
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {courses.length === 0 && drinkRows.length === 0 && (
          <div className="border-t border-border/20 pt-5">
            <p className="text-sm text-muted-foreground font-sans italic">
              Menüdetails werden noch zusammengestellt.
            </p>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="px-6 py-4 bg-muted/30 border-t border-border/10">
        {!isStripePayment ? (
          totalAmount > 0 ? (
            <div className="text-center space-y-2">
              <p className="text-sm font-sans font-medium text-foreground/80">
                {paymentMethod === 'on_site'
                  ? 'Zahlung erfolgt vor Ort beim Event'
                  : `Rechnung nach dem Event — zahlbar innerhalb ${invoiceDueDays} Tagen`}
              </p>
              <p className="text-lg font-serif font-bold text-primary">
                {formatCurrencyDecimal(totalAmount)}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground font-sans py-1">
              Kontaktieren Sie uns für die Buchung.
            </p>
          )
        ) : option.offer_mode === 'paket' ? (
          <Button
            className="w-full h-12 gap-2 rounded-full font-sans font-semibold text-base shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-80 disabled:hover:translate-y-0"
            onClick={() => handlePayment('full')}
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Zahlung wird vorbereitet…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Jetzt zahlen — {formatCurrencyDecimal(totalAmount)}
              </>
            )}
          </Button>
        ) : totalAmount > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-sans font-medium text-center text-foreground/80">
              {isRedirecting ? 'Zahlung wird vorbereitet…' : 'Wie möchten Sie zahlen?'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePayment('full')}
                disabled={isRedirecting}
                className="p-4 rounded-xl border-2 border-primary text-center hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="font-bold text-sm font-sans block">{formatCurrencyDecimal(totalAmount)}</span>
                    <span className="text-xs font-sans text-muted-foreground block mt-0.5">Komplett zahlen</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handlePayment('deposit')}
                disabled={isRedirecting}
                className="p-4 rounded-xl border border-border text-center hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    <span className="font-bold text-sm font-sans block">{formatCurrencyDecimal(depositAmount)}</span>
                    <span className="text-xs font-sans text-muted-foreground block mt-0.5">20% Anzahlung</span>
                    <span className="text-[10px] font-sans text-muted-foreground/60 block">Rest vor dem Event</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground font-sans py-1">
            Kontaktieren Sie uns für die Buchung.
          </p>
        )}

        {totalAmount > 0 && <CancellationTermsAccordion />}
      </div>
    </div>
  );
}
