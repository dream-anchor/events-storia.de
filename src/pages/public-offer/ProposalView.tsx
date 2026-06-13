import { useEffect, useMemo, useRef, useState } from "react";
import {
  UtensilsCrossed,
  Wine,
  CreditCard,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  Copy,
  Lock,
  ShieldCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Info,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentSession, type PaymentSessionRequest } from "@/lib/createPaymentSession";
import { toast } from "sonner";
import type {
  PublicInquiry,
  PublicOfferOption,
  PublicOfferData,
  MenuSelection,
  OfferPhase,
} from "./types";
import { formatCurrency, formatCurrencyDecimal, buildDrinkRows } from "./types";
import { CancellationTermsAccordion } from "./ContactSection";
import { FreeformProgramSection } from "./FreeformProgramSection";

export function ProposalView({
  inquiry,
  options,
  onSubmitted,
  isArchiveMode = false,
  isPreviewMode = false,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  onSubmitted: (data: PublicOfferData) => void;
  isArchiveMode?: boolean;
  isPreviewMode?: boolean;
}) {
  // Single-Option ist auto-selected — Kunde muss nichts extra auswählen
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    options.length === 1 ? options[0].id : null
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState<'full' | 'deposit' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wantsCopy, setWantsCopy] = useState(false);
  const [copyEmail, setCopyEmail] = useState(inquiry.email || "");

  // Multi-Options-Mengen: Map optionId -> Menge (initial 0 für alle)
  // Persistiert in localStorage, damit Stripe-Cancel die Auswahl nicht zerstört.
  const QUANTITY_STORAGE_KEY = `storia_offer_qty_${inquiry.id}`;

  // Sprechender Menü-/Paket-Name für Summary, Submit-Notes etc.
  // Bei Custom-Menüs Fallback auf "Menü A/B/C" statt "Option A".
  const formatOptionLabel = (o: PublicOfferOption): string => {
    const name = o.package_name?.trim();
    const isCustom =
      o.offer_mode === 'menu' ||
      !name ||
      name === 'Individuelles Paket' ||
      name === 'Individuelles Menü';
    return isCustom ? `Menü ${o.option_label}` : name!;
  };

  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() => {
    const empty = Object.fromEntries(options.map(o => [o.id, 0]));
    if (typeof window === 'undefined') return empty;
    try {
      const saved = window.localStorage.getItem(QUANTITY_STORAGE_KEY);
      if (!saved) return empty;
      const parsed = JSON.parse(saved) as Record<string, number>;
      // Nur Keys aus aktuellem Angebot übernehmen (Stale-Schutz)
      return Object.fromEntries(
        options.map(o => [o.id, typeof parsed[o.id] === 'number' ? parsed[o.id] : 0])
      );
    } catch {
      return empty;
    }
  });

  // Mengen bei jeder Änderung in localStorage spiegeln
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(QUANTITY_STORAGE_KEY, JSON.stringify(optionQuantities));
    } catch {
      /* quota exceeded — ignorieren */
    }
  }, [optionQuantities, QUANTITY_STORAGE_KEY]);

  // Ziel-Gästezahl aus inquiry.guest_count parsen.
  // Akzeptiert: "40" → 40, "20-30" → 30 (Maximum), "ca. 25" → 25.
  // Bei nicht parsebarem Wert: null (kein hartes Ziel).
  const targetGuests = useMemo<number | null>(() => {
    const raw = inquiry.guest_count?.trim();
    if (!raw) return null;
    const matches = raw.match(/\d+/g);
    if (!matches || matches.length === 0) return null;
    const nums = matches.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);
    if (nums.length === 0) return null;
    return Math.max(...nums);
  }, [inquiry.guest_count]);

  // Single-Option: Auto-Quantity aus Target oder option.guest_count
  useEffect(() => {
    const isSingle = options.length === 1;
    if (!isSingle) return;
    const opt = options[0];
    if (!opt) return;
    const isPerEvent = opt.menu_selection?.pricingMode === 'per_event';
    const auto = isPerEvent ? 1 : (targetGuests ?? opt.guest_count ?? 0);
    setOptionQuantities(prev => {
      if (prev[opt.id] === auto) return prev;
      return { ...prev, [opt.id]: auto };
    });
  }, [options, targetGuests]);

  // Pro-Person-Preis pro Option (per_event: total_amount als Pauschale)
  const perPersonPriceFor = (opt: PublicOfferOption): number => {
    const ms = opt.menu_selection;
    if (ms?.pricingMode === 'per_event') return opt.total_amount;
    const budget = ms?.budgetPerPerson;
    if (budget && budget > 0) return budget;
    if (opt.guest_count > 0) return opt.total_amount / opt.guest_count;
    return 0;
  };

  const totalQuantity = Object.values(optionQuantities).reduce((s, q) => s + (q || 0), 0);
  const multiOptionsTotal = options.reduce(
    (sum, o) => sum + (optionQuantities[o.id] || 0) * perPersonPriceFor(o),
    0
  );
  const hasQuantities = totalQuantity > 0;

  const selectedOption = options.find(o => o.id === selectedOptionId) || null;
  const totalAmount = hasQuantities
    ? multiOptionsTotal
    : (selectedOption?.total_amount ?? 0);
  // Zahlungs-Konditionen aus Inquiry (RPC liefert Defaults aus site_settings)
  const paymentMethod = (inquiry.payment_method || 'deposit_online') as string;
  // Sicherer Default für deposit_percent NUR bei deposit_online; sonst 0.
  const depositPercent = inquiry.deposit_percent ?? (paymentMethod === 'deposit_online' ? 20 : 0);
  const fixedDepositAmount = inquiry.deposit_amount ?? null;
  const depositDueDays = inquiry.deposit_due_days ?? 5;
  const invoiceDueDays = inquiry.invoice_due_days ?? 14;
  const isStripePayment = paymentMethod === 'deposit_online' || paymentMethod === 'prepayment_online';
  const isFixedDeposit = fixedDepositAmount != null && fixedDepositAmount > 0;
  const depositAmount = isFixedDeposit
    ? Math.min(fixedDepositAmount as number, totalAmount)
    // Keine Rundung — exakter Betrag aus Maestro/Total × % anzeigen.
    : (depositPercent > 0 ? (totalAmount * depositPercent) / 100 : 0);
  const showDeposit = isStripePayment
    && depositAmount > 0
    && depositAmount < totalAmount
    && (isFixedDeposit || depositPercent < 100);

  // ACTION: Zahlung — leitet zu Stripe Checkout weiter
  const handlePayment = async (paymentType: 'full' | 'deposit') => {
    if (!hasQuantities && !selectedOptionId) return;
    setIsPaying(paymentType);
    haptic('select');
    try {
      const body = hasQuantities
        ? {
            inquiryId: inquiry.id,
            paymentType,
            optionQuantities: Object.entries(optionQuantities)
              .filter(([, q]) => q > 0)
              .map(([optionId, quantity]) => ({ optionId, quantity })),
          }
        : { inquiryId: inquiry.id, optionId: selectedOptionId, paymentType };
      const { checkoutUrl } = await createPaymentSession(body);
      window.location.href = checkoutUrl;
    } catch (err) {
      setIsPaying(null);
      toast.error(
        err instanceof Error ? err.message : 'Fehler bei der Zahlung',
        {
          description: 'Bitte versuchen Sie es erneut oder kontaktieren Sie uns unter 089 51519696.',
          duration: 6000,
        }
      );
    }
  };

  // ACTION: Verbindlich buchen — für on_site / invoice_after (kein Stripe)
  const handleConfirmBooking = async () => {
    if (!canPay) return;
    // Multi-Option: confirm_offline_booking_multi verwenden
    if (hasQuantities) {
      const quantities = Object.entries(optionQuantities)
        .filter(([, q]) => q > 0)
        .map(([optionId, quantity]) => ({ optionId, quantity }));
      if (quantities.length === 0) return;
      setIsSubmitting(true);
      setSubmitError(null);
      haptic('select');
      try {
        const { data: result, error: rpcError } = await supabase.rpc(
          "confirm_offline_booking_multi" as never,
          {
            p_inquiry_id: inquiry.id,
            p_option_quantities: quantities,
          } as never
        );
        const res = result as unknown as { success: boolean; error?: string };
        if (rpcError || !res?.success) {
          setSubmitError(res?.error || "Fehler beim Buchen");
          toast.error(res?.error || "Fehler beim Buchen");
          return;
        }
        supabase.functions.invoke("notify-customer-response", {
          body: { inquiryId: inquiry.id },
        }).catch(() => {});
        try { window.localStorage.removeItem(QUANTITY_STORAGE_KEY); } catch { /* ignore */ }
        onSubmitted({
          inquiry: { ...inquiry, offer_phase: "confirmed" },
          options,
          customer_response: {
            id: crypto.randomUUID(),
            selected_option_id: quantities[0].optionId,
            customer_notes: paymentMethod === 'on_site' ? 'Verbindlich gebucht — Zahlung vor Ort' : 'Verbindlich gebucht — Rechnung nach Event',
            responded_at: new Date().toISOString(),
          },
        });
      } catch {
        setSubmitError("Netzwerkfehler — bitte versuchen Sie es erneut");
        toast.error("Netzwerkfehler — bitte versuchen Sie es erneut");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    const optId = selectedOptionId;
    if (!optId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    haptic('select');
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        "confirm_offline_booking" as never,
        {
          p_inquiry_id: inquiry.id,
          p_selected_option_id: optId,
        } as never
      );
      const res = result as unknown as { success: boolean; error?: string };
      if (rpcError || !res?.success) {
        setSubmitError(res?.error || "Fehler beim Buchen");
        toast.error(res?.error || "Fehler beim Buchen");
        return;
      }

      // Notify admin about booking
      supabase.functions.invoke("notify-customer-response", {
        body: { inquiryId: inquiry.id },
      }).catch(() => {});

      try { window.localStorage.removeItem(QUANTITY_STORAGE_KEY); } catch { /* ignore */ }

      onSubmitted({
        inquiry: {
          ...inquiry,
          offer_phase: "confirmed",
          selected_option_id: optId,
        },
        options,
        customer_response: {
          id: crypto.randomUUID(),
          selected_option_id: optId,
          customer_notes: paymentMethod === 'on_site' ? 'Verbindlich gebucht — Zahlung vor Ort' : `Verbindlich gebucht — Rechnung nach Event`,
          responded_at: new Date().toISOString(),
        },
      });
    } catch {
      setSubmitError("Netzwerkfehler — bitte versuchen Sie es erneut");
      toast.error("Netzwerkfehler — bitte versuchen Sie es erneut");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ACTION: Nachricht senden — submit_offer_response-Flow
  const handleSendMessage = async () => {
    if (!selectedOptionId || !notes.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const breakdownLine = hasQuantities
        ? `Meine Aufteilung: ${options
            .filter(o => (optionQuantities[o.id] || 0) > 0)
            .map(o => `${formatOptionLabel(o)} × ${optionQuantities[o.id]}`)
            .join(', ')} (${totalQuantity} Gäste)\n\n`
        : '';
      const finalNotes = breakdownLine + notes.trim();
      const { data: result, error: rpcError } = await supabase.rpc(
        "submit_offer_response" as never,
        {
          p_inquiry_id: inquiry.id,
          p_selected_option_id: selectedOptionId,
          p_customer_notes: finalNotes,
        } as never
      );

      const res = result as unknown as { success: boolean; error?: string };

      if (rpcError || !res?.success) {
        setSubmitError(res?.error || "Fehler beim Absenden");
        return;
      }

      supabase.functions.invoke("notify-customer-response", {
        body: { inquiryId: inquiry.id },
      }).catch(() => {});

      // Auswahl aus localStorage entfernen — Submission abgeschlossen
      try {
        window.localStorage.removeItem(QUANTITY_STORAGE_KEY);
      } catch {
        /* ignore */
      }

      if (wantsCopy && copyEmail.trim()) {
        supabase.functions.invoke("send-customer-response-copy", {
          body: {
            inquiryId: inquiry.id,
            customerEmail: copyEmail.trim(),
            selectedOptionLabel: selectedOption
              ? `Option ${selectedOption.option_label}: ${selectedOption.package_name}`
              : "Ihre Auswahl",
            customerNotes: finalNotes,
          },
        }).catch(() => {});
      }

      onSubmitted({
        inquiry: {
          ...inquiry,
          offer_phase: "customer_responded",
          selected_option_id: selectedOptionId,
        },
        options,
        customer_response: {
          id: crypto.randomUUID(),
          selected_option_id: selectedOptionId,
          customer_notes: finalNotes,
          responded_at: new Date().toISOString(),
        },
      });
    } catch {
      setSubmitError("Netzwerkfehler — bitte versuchen Sie es erneut");
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isPaying !== null;
  const isSingle = options.length === 1;
  // Bei Multi-Options ist eine Mengen-Eingabe Pflicht. Bei Single reicht die Auto-Menge.
  const canPay = isSingle
    ? (!!selectedOption && totalAmount > 0)
    : (hasQuantities && multiOptionsTotal > 0);

  return (
    <section className="bg-secondary/30">
      {/* MOBILE STICKY PROGRESS — 3 steps: Read → Choose → Book. lg:hidden. */}
      {!isArchiveMode && !isPreviewMode && (
        <MobileProgressStrip
          step={
            canPay ? 3 : selectedOptionId ? 2 : 1
          }
          isSingle={isSingle}
        />
      )}
      <div className="container mx-auto px-4 py-12 md:py-16 pb-32 lg:pb-16">
        <div className="max-w-4xl">
          {/* Sektion-Header */}
          <div className="mb-10">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
              {isSingle ? "Unser Vorschlag" : "Ihr Angebot"}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-3">
              {isSingle ? "Ihr Angebot" : "Ihre Auswahl"}
            </h2>
            <p className="text-muted-foreground font-sans text-sm md:text-base max-w-xl">
              {isSingle
                ? "Buchen Sie direkt über den sicheren Zahlungslink — oder schreiben Sie uns bei Fragen und Änderungen."
                : "Wir haben mehrere Varianten für Sie zusammengestellt — entscheiden Sie sich für eine oder kombinieren Sie mehrere mit unterschiedlichen Mengen."}
            </p>
          </div>

          {/* Options — Mobile: Snap-Carousel mit Pill-Tabs; lg+: 2-Spalten-Grid */}
          {options.length > 1 ? (
            <MultiOptionCarousel
              options={options}
              selectedOptionId={selectedOptionId}
              setSelectedOptionId={setSelectedOptionId}
              optionQuantities={optionQuantities}
              setOptionQuantities={setOptionQuantities}
              perPersonPriceFor={perPersonPriceFor}
              targetGuests={targetGuests}
              totalQuantity={totalQuantity}
              isSingle={isSingle}
              formatOptionLabel={formatOptionLabel}
            />
          ) : (
            <div className="gap-6 mb-12 max-w-2xl">
              {options.map((option) => (
                <ProposalOptionCard
                  key={option.id}
                  option={option}
                  isSelected={selectedOptionId === option.id}
                  onSelect={() => setSelectedOptionId(option.id)}
                  singleOption={isSingle}
                  quantity={optionQuantities[option.id] || 0}
                  onQuantityChange={(q) => {
                    const isPerEvent = option.menu_selection?.pricingMode === 'per_event';
                    const clamped = isPerEvent ? Math.min(1, Math.max(0, q)) : Math.max(0, q);
                    setOptionQuantities((prev) => ({ ...prev, [option.id]: clamped }));
                  }}
                  perPersonPrice={perPersonPriceFor(option)}
                  targetGuests={targetGuests}
                  remainingGuests={
                    targetGuests !== null
                      ? Math.max(0, targetGuests - totalQuantity)
                      : null
                  }
                />
              ))}
            </div>
          )}

          {/* Live-Summary für Multi-Options-Modus (bei Single ausgeblendet — Menge ist fix) */}
          {!isSingle && (
            <div className="max-w-2xl mb-6 rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.15em] text-primary/70">
                    Ihre Auswahl
                  </p>
                  {hasQuantities ? (
                    <>
                      <p className="text-sm font-sans text-foreground mt-1 truncate" title={options.filter((o) => (optionQuantities[o.id] || 0) > 0).map((o) => `${formatOptionLabel(o)} × ${optionQuantities[o.id]}`).join(' · ')}>
                        {options
                          .filter((o) => (optionQuantities[o.id] || 0) > 0)
                          .map((o) => `${formatOptionLabel(o)} × ${optionQuantities[o.id]}`)
                          .join(' · ')}
                      </p>
                      <p className="text-xs font-sans text-muted-foreground mt-0.5">
                        {totalQuantity} {totalQuantity === 1 ? 'Gast' : 'Gäste'} verteilt
                        {targetGuests !== null && ` von ${targetGuests}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-sans text-muted-foreground mt-1">
                      Bitte verteilen Sie Ihre Gäste auf die gewünschten Optionen.
                    </p>
                  )}
                </div>
                <p className="text-xl font-serif font-bold text-primary whitespace-nowrap">
                  {formatCurrencyDecimal(multiOptionsTotal)}
                </p>
              </div>

              {/* Fortschritts-Anzeige nur wenn Ziel bekannt */}
              {targetGuests !== null && (
                <div>
                  <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(100, (totalQuantity / targetGuests) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-sans text-foreground/80">
                    {totalQuantity < targetGuests && (
                      <>Es fehlen noch <strong>{targetGuests - totalQuantity}</strong> {targetGuests - totalQuantity === 1 ? 'Gast' : 'Gäste'} von insgesamt <strong>{targetGuests}</strong>.</>
                    )}
                    {totalQuantity === targetGuests && (
                      <>✓ Alle <strong>{targetGuests}</strong> Gäste verteilt.</>
                    )}
                    {totalQuantity > targetGuests && (
                      <><strong>{totalQuantity - targetGuests}</strong> {totalQuantity - targetGuests === 1 ? 'Gast' : 'Gäste'} über der ursprünglich angefragten Menge ({targetGuests}).</>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PRIMARY ACTION — Buchen */}
          <div className="max-w-2xl mb-10">
            <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-primary/20 p-6 md:p-8 shadow-[0_8px_30px_rgba(139,0,0,0.08)]">
              <div className="mb-6">
                <h3 className="font-serif text-xl md:text-2xl font-bold text-foreground mb-1">
                  Jetzt verbindlich buchen
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  {!canPay
                    ? (isSingle
                        ? "Wählen Sie oben eine Option."
                        : "Bitte Mengen pro Option angeben.")
                    : isStripePayment
                      ? (hasQuantities
                          ? `Sicher bezahlen über Stripe — für ${totalQuantity} ${totalQuantity === 1 ? 'Gast' : 'Gäste'}`
                          : "Sicher bezahlen über Stripe — Kreditkarte, Apple Pay oder SEPA")
                      : paymentMethod === 'on_site'
                        ? "Zahlung erfolgt vor Ort beim Event."
                        : `Rechnung wird nach dem Event zugestellt — zahlbar innerhalb ${invoiceDueDays} Tagen.`}
                </p>
              </div>

              {isStripePayment ? (
                /* STRIPE-Zahlungsmodus */
                <div className={cn("grid gap-3", showDeposit ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                  {/* Voll bezahlen — Primary/Dominant */}
                  <Button
                    onClick={() => handlePayment('full')}
                    disabled={busy || !canPay}
                    className="h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_15px_rgba(139,0,0,0.25)]"
                  >
                    <span className="flex items-center gap-2 w-full justify-between">
                      <span className="text-sm">Voll bezahlen</span>
                      {isPaying === 'full' && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    {canPay ? (
                      <span className="text-lg font-serif font-bold">
                        {formatCurrency(totalAmount)}
                      </span>
                    ) : (
                      <span className="text-sm font-sans opacity-70">Option wählen</span>
                    )}
                  </Button>

                  {/* Anzahlung — nur wenn 0 < deposit_percent < 100 */}
                  {showDeposit && (
                    <div>
                      <Button
                        onClick={() => handlePayment('deposit')}
                        disabled={busy || !canPay}
                        variant="outline"
                        className="w-full h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 border-2 border-primary/30 text-foreground bg-white/50 hover:bg-white/80 hover:border-primary/50 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2 w-full justify-between">
                          <span className="text-sm">
                            Anzahlung {isFixedDeposit ? formatCurrencyDecimal(depositAmount) : `${depositPercent} %`}
                          </span>
                          {isPaying === 'deposit' && <Loader2 className="h-4 w-4 animate-spin" />}
                        </span>
                        {canPay ? (
                          <span className="text-lg font-serif font-bold text-primary">
                            {formatCurrencyDecimal(depositAmount)}
                          </span>
                        ) : (
                          <span className="text-sm font-sans opacity-70 text-muted-foreground">Option wählen</span>
                        )}
                      </Button>
                      {canPay && (
                        <p className="mt-1.5 text-[11px] font-sans text-muted-foreground/70 text-center">
                          innerhalb {depositDueDays} {depositDueDays === 1 ? 'Tag' : 'Tagen'} zu zahlen
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* VOR-ORT / RECHNUNG — kein Stripe, nur Bestätigung */
                <div className="grid gap-3 grid-cols-1">
                  <Button
                    onClick={handleConfirmBooking}
                    disabled={busy || !canPay}
                    className="h-auto py-4 px-5 rounded-xl font-sans font-semibold flex flex-col items-start gap-0.5 shadow-[0_4px_15px_rgba(139,0,0,0.25)] hover:shadow-[0_8px_25px_rgba(139,0,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <span className="flex items-center gap-2 w-full justify-between">
                      <span className="text-sm">
                        {paymentMethod === 'on_site' ? 'Verbindlich buchen — Zahlung vor Ort' : 'Verbindlich buchen — Rechnung nach Event'}
                      </span>
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    {canPay && (
                      <span className="text-lg font-serif font-bold">
                        {formatCurrency(totalAmount)}
                      </span>
                    )}
                  </Button>
                </div>
              )}

              {/* Trust-Elemente */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-xs text-muted-foreground font-sans">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  SSL-verschlüsselt
                </span>
                {isStripePayment ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3" />
                      Sichere Zahlung via Stripe
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />
                      Rechnung folgt per E-Mail
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    {paymentMethod === 'on_site' ? 'Zahlung vor Ort beim Event' : `Rechnung zahlbar innerhalb ${invoiceDueDays} Tagen`}
                  </span>
                )}
              </div>

              {/* Hinweis bei Teilbuchung im Multi-Mode */}
              {!isSingle && canPay && targetGuests !== null && totalQuantity < targetGuests && (
                <p className="mt-4 text-xs font-sans text-muted-foreground">
                  Sie können auch mit einer Teilmenge buchen — die restlichen Gäste lassen sich später ergänzen.
                </p>
              )}
            </div>
          </div>

          {/* Stornobedingungen — direkt unter der Buchen-Box (nur wenn buchbar) */}
          {selectedOption && totalAmount > 0 && (
            <div className="max-w-2xl mb-10 px-2">
              <CancellationTermsAccordion />
            </div>
          )}

          {/* SECONDARY ACTION — Nachricht senden */}
          <div className="max-w-2xl">
            <div className="rounded-2xl border border-border/40 bg-white/40 dark:bg-white/5 backdrop-blur-sm p-6 md:p-7">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary/70" />
                  Noch eine Frage oder Änderung?
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  Schreiben Sie uns — z.B. Allergien, vegetarische Gäste oder Sonderwünsche. Wir melden uns mit einem angepassten Angebot.
                </p>
              </div>

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ihre Nachricht an uns …"
                className="min-h-[110px] rounded-xl resize-y font-sans text-base"
              />

              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantsCopy}
                    onChange={(e) => setWantsCopy(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground font-sans flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    Kopie der Nachricht per E-Mail erhalten
                  </span>
                </label>
                {wantsCopy && (
                  <div className="mt-2 ml-6">
                    <Input
                      type="email"
                      value={copyEmail}
                      onChange={(e) => setCopyEmail(e.target.value)}
                      placeholder="ihre@email.de"
                      className="max-w-sm h-10 rounded-lg font-sans"
                    />
                  </div>
                )}
              </div>

              {submitError && (
                <p className="text-sm text-destructive mt-3 font-sans">{submitError}</p>
              )}

              <Button
                onClick={handleSendMessage}
                disabled={!selectedOptionId || !notes.trim() || busy}
                variant="outline"
                className="mt-5 h-11 px-6 rounded-full font-sans font-medium gap-2 border-border/60 hover:border-primary/40 hover:bg-primary/5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Nachricht senden
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOOKING BAR — fixed bottom, nur < lg, mit Safe-Area */}
      <MobileStickyBookingBar
        canPay={canPay}
        busy={busy}
        totalAmount={totalAmount}
        depositAmount={depositAmount}
        depositPercent={depositPercent}
        isFixedDeposit={isFixedDeposit}
        showDeposit={showDeposit}
        isPaying={isPaying}
        onPay={handlePayment}
        onConfirmBooking={handleConfirmBooking}
        isSubmitting={isSubmitting}
        paymentMethod={paymentMethod}
        isSingle={isSingle}
        hasQuantities={hasQuantities}
        totalQuantity={totalQuantity}
        isArchiveMode={isArchiveMode}
        isPreviewMode={isPreviewMode}
      />
    </section>
  );
}
function MultiOptionCarousel({
  options,
  selectedOptionId,
  setSelectedOptionId,
  optionQuantities,
  setOptionQuantities,
  perPersonPriceFor,
  targetGuests,
  totalQuantity,
  isSingle,
  formatOptionLabel,
}: {
  options: PublicOfferOption[];
  selectedOptionId: string | null;
  setSelectedOptionId: (id: string) => void;
  optionQuantities: Record<string, number>;
  setOptionQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  perPersonPriceFor: (opt: PublicOfferOption) => number;
  targetGuests: number | null;
  totalQuantity: number;
  isSingle: boolean;
  formatOptionLabel: (o: PublicOfferOption) => string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Sync active card on horizontal scroll (mobile only).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (!w) return;
        const idx = Math.round(el.scrollLeft / w);
        setActiveIdx(idx);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scrollTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    haptic("select");
  };

  return (
    <div className="mb-12">
      {/* Pill-Tabs (mobile only) */}
      <div className="lg:hidden mb-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {options.map((o, i) => {
          const qty = optionQuantities[o.id] || 0;
          const isActive = i === activeIdx;
          return (
            <button
              key={o.id}
              onClick={() => scrollTo(i)}
              className={cn(
                "snap-start shrink-0 rounded-full border px-3.5 py-2 text-xs font-sans transition-all whitespace-nowrap",
                isActive
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-foreground border-border/60 hover:border-foreground/40",
              )}
              aria-current={isActive ? "true" : undefined}
            >
              <span className="font-semibold">Option {o.option_label}</span>
              {qty > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1">
                  {qty}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile snap-scroll container; lg+: grid */}
      <div
        ref={scrollerRef}
        className={cn(
          // Mobile: horizontal snap scroller (one card per viewport)
          "flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2",
          // Desktop: revert to plain grid; disable scroll-snap
          "lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0",
        )}
      >
        {options.map((option) => (
          <div
            key={option.id}
            className="snap-center shrink-0 w-[88vw] max-w-[480px] lg:w-auto lg:max-w-none"
          >
            <ProposalOptionCard
              option={option}
              isSelected={selectedOptionId === option.id}
              onSelect={() => {
                setSelectedOptionId(option.id);
                haptic("tick");
              }}
              singleOption={isSingle}
              quantity={optionQuantities[option.id] || 0}
              onQuantityChange={(q) => {
                const isPerEvent = option.menu_selection?.pricingMode === "per_event";
                const clamped = isPerEvent ? Math.min(1, Math.max(0, q)) : Math.max(0, q);
                setOptionQuantities((prev) => ({ ...prev, [option.id]: clamped }));
              }}
              perPersonPrice={perPersonPriceFor(option)}
              targetGuests={targetGuests}
              remainingGuests={
                targetGuests !== null ? Math.max(0, targetGuests - totalQuantity) : null
              }
            />
          </div>
        ))}
      </div>

      {/* Pagination dots + arrows (mobile only) */}
      {options.length > 1 && (
        <div className="lg:hidden mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => activeIdx > 0 && scrollTo(activeIdx - 1)}
            disabled={activeIdx === 0}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60 disabled:opacity-30"
            aria-label="Vorherige Option"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {options.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`Option ${i + 1} anzeigen`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === activeIdx ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25",
                )}
              />
            ))}
          </div>
          <button
            onClick={() => activeIdx < options.length - 1 && scrollTo(activeIdx + 1)}
            disabled={activeIdx >= options.length - 1}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60 disabled:opacity-30"
            aria-label="Nächste Option"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// =================================================================
// MOBILE STICKY BOOKING BAR
// =================================================================
function MobileProgressStrip({ step, isSingle }: { step: 1 | 2 | 3; isSingle: boolean }) {
  const labels = isSingle
    ? ["Angebot lesen", "Menge prüfen", "Buchen"]
    : ["Optionen ansehen", "Variante wählen", "Buchen"];
  return (
    <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-neutral-200">
      <div className="px-4 pt-2 pb-2.5">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n, i) => {
            const active = step >= n;
            const current = step === n;
            return (
              <div key={n} className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className={cn(
                    "shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums transition-colors",
                    active
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-200 text-neutral-500"
                  )}
                >
                  {step > n ? "✓" : n}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-sans truncate transition-colors",
                    current ? "text-neutral-900 font-semibold" : active ? "text-neutral-700" : "text-neutral-400"
                  )}
                >
                  {labels[i]}
                </span>
                {i < 2 && (
                  <div
                    className={cn(
                      "h-px flex-1 transition-colors",
                      step > n ? "bg-neutral-900" : "bg-neutral-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileStickyBookingBar({
  canPay,
  busy,
  totalAmount,
  depositAmount,
  depositPercent,
  isFixedDeposit,
  showDeposit,
  isPaying,
  onPay,
  onConfirmBooking,
  isSubmitting,
  paymentMethod,
  isSingle,
  hasQuantities,
  totalQuantity,
  isArchiveMode,
  isPreviewMode,
}: {
  canPay: boolean;
  busy: boolean;
  totalAmount: number;
  depositAmount: number;
  depositPercent: number;
  isFixedDeposit: boolean;
  showDeposit: boolean;
  isPaying: 'full' | 'deposit' | null;
  onPay: (type: 'full' | 'deposit') => void;
  onConfirmBooking: () => void;
  isSubmitting: boolean;
  paymentMethod: string;
  isSingle: boolean;
  hasQuantities: boolean;
  totalQuantity: number;
  isArchiveMode: boolean;
  isPreviewMode: boolean;
}) {
  const isStripePayment = paymentMethod === 'deposit_online' || paymentMethod === 'prepayment_online';
  // Im Archiv-Modus komplett verstecken — nur Lese-Ansicht.
  if (isArchiveMode) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85",
        "shadow-[0_-8px_30px_rgba(0,0,0,0.08)]",
        "px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
      )}
      role="region"
      aria-label="Buchen"
    >
      {isPreviewMode && (
        <p className="mb-1.5 text-[10px] italic text-neutral-500 text-center">
          Vorschau — nur Anzeige
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-sans uppercase tracking-wider text-neutral-500">
            {canPay
              ? (hasQuantities
                  ? `${totalQuantity} ${totalQuantity === 1 ? 'Gast' : 'Gäste'} · Gesamt`
                  : 'Gesamt')
              : (isSingle ? 'Bitte oben Option wählen' : 'Mengen oben angeben')}
          </p>
          <p className="font-serif text-lg font-bold text-neutral-900 tabular-nums truncate">
            {canPay ? formatCurrency(totalAmount) : '—'}
          </p>
        </div>

        {isStripePayment ? (
          <>
            {showDeposit && canPay && (
              <Button
                onClick={() => onPay('deposit')}
                disabled={busy || isPreviewMode}
                variant="outline"
                className="h-12 px-3 rounded-xl flex flex-col items-center justify-center gap-0 border-primary/30"
              >
                <span className="text-[10px] uppercase tracking-wider font-sans leading-none">
                  {isFixedDeposit ? 'Anzahl.' : `${depositPercent}%`}
                </span>
                <span className="text-xs font-semibold tabular-nums leading-tight">
                  {formatCurrencyDecimal(depositAmount)}
                </span>
                {isPaying === 'deposit' && (
                  <Loader2 className="h-3 w-3 animate-spin absolute" />
                )}
              </Button>
            )}
            <Button
              onClick={() => onPay('full')}
              disabled={busy || !canPay || isPreviewMode}
              className="h-12 px-5 rounded-xl font-sans font-semibold shadow-[0_4px_15px_rgba(139,0,0,0.25)] flex items-center gap-2"
            >
              {isPaying === 'full' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Buchen
            </Button>
          </>
        ) : (
          <Button
            onClick={onConfirmBooking}
            disabled={busy || !canPay || isPreviewMode}
            className="h-12 px-5 rounded-xl font-sans font-semibold shadow-[0_4px_15px_rgba(139,0,0,0.25)] flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {paymentMethod === 'on_site' ? 'Buchen' : 'Buchen'}
          </Button>
        )}
      </div>
    </div>
  );
}
function ProposalOptionCard({
  option,
  isSelected,
  onSelect,
  singleOption,
  quantity,
  onQuantityChange,
  perPersonPrice: perPersonPriceProp,
  targetGuests,
  remainingGuests,
}: {
  option: PublicOfferOption;
  isSelected: boolean;
  onSelect: () => void;
  singleOption: boolean;
  quantity: number;
  onQuantityChange: (q: number) => void;
  perPersonPrice: number;
  targetGuests: number | null;
  remainingGuests: number | null;
}) {
  const menu = option.menu_selection;
  const courses = menu?.courses?.filter((c) => c.itemName) || [];
  const drinkRows = buildDrinkRows(menu);
  const freeformProgram = menu?.freeformProgram ?? null;
  const isFreeform = option.offer_mode === 'freeform' || !!freeformProgram;
  // Pricing-Modus respektieren: bei per_event ist budgetPerPerson der Gesamtpreis
  // fuer den ganzen Anlass (nicht pro Gast). Dann zeigen wir statt "pro Person"
  // den Gesamtbetrag mit Label "Gesamtpreis".
  const isPerEvent = menu?.pricingMode === 'per_event';
  const pricePerPerson = isPerEvent
    ? 0
    : option.guest_count > 0
      ? (menu?.budgetPerPerson && menu.budgetPerPerson > 0
          ? menu.budgetPerPerson
          : option.total_amount / option.guest_count)
      : 0;


  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "w-full text-left rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "bg-white/70 dark:bg-white/10 backdrop-blur-sm border-2",
        "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
        isSelected
          ? "border-primary ring-1 ring-primary/20 shadow-[0_8px_30px_rgba(139,0,0,0.1)]"
          : "border-white/60 dark:border-white/20 hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
      )}
    >
      {/* Header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {!singleOption && (
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold font-sans shrink-0 transition-colors mt-0.5",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {option.option_label}
            </div>
          )}
          <div>
            <h3 className="font-serif text-lg font-bold text-foreground leading-tight">
              {option.offer_mode === "menu" || option.package_name === "Individuelles Paket" || option.package_name === "Individuelles Menü"
                ? "Individuelles Menü"
                : option.package_name}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {option.guest_count} Gäste
            </p>
            {/* Paket-Beschreibung + enthaltene Leistungen (nur bei DB-Paketen) */}
            {option.package_description && (
              <p className="text-xs text-muted-foreground/80 font-sans mt-2 leading-relaxed">
                {option.package_description}
              </p>
            )}
            {Array.isArray(option.package_includes) && option.package_includes.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {option.package_includes.map((inc, i) => (
                  <li
                    key={i}
                    className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-primary/5 border border-primary/15 text-foreground/80"
                  >
                    {inc}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Preis */}
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

      {/* Menü-Details im Speisekarten-Stil — lesbar, wertig */}
      {isFreeform && freeformProgram ? (
        <div className="px-6 pb-6">
          <div className="border-t border-border/20 pt-5">
            <FreeformProgramSection program={freeformProgram} />
          </div>
        </div>
      ) : (courses.length > 0 || drinkRows.length > 0 || (menu?.equipment?.length ?? 0) > 0 || (menu?.staff?.length ?? 0) > 0) && (
        <div className="px-6 pb-6">
          <div className="border-t border-border/20 pt-5">
            {courses.length > 0 && (
              <div className="space-y-4">
                {courses.map((c, i) => (
                  <div key={i} className="flex items-baseline gap-4">
                    <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em] w-24 flex-shrink-0 pt-0.5">
                      {c.courseLabel}
                    </span>
                    <div className="flex-1">
                      <p className="text-base md:text-lg font-serif text-foreground leading-snug">
                        {(c.quantity ?? 1) > 1 ? `${c.quantity} × ${c.itemName}` : c.itemName}
                      </p>
                      {c.itemDescription && (
                        <p className="text-sm font-sans text-foreground/70 mt-1 leading-relaxed">
                          {c.itemDescription}
                        </p>
                      )}
                    </div>
                    {option.offer_mode === 'paket' && c.overridePrice != null && c.overridePrice > 0 && (
                      <span className="text-xs font-sans text-muted-foreground tabular-nums shrink-0">
                        + {formatCurrencyDecimal(c.overridePrice)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {drinkRows.length > 0 && (
              <div className={cn("space-y-3", courses.length > 0 && "mt-6 pt-5 border-t border-border/15")}>
                {drinkRows.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-4">
                    <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em] w-24 flex-shrink-0">
                      {d.label}
                    </span>
                    <div className="flex-1">
                      <p className="text-base font-serif text-foreground leading-snug">
                        {d.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Equipment */}
            {menu?.equipment && menu.equipment.filter(e => e.name).length > 0 && (
              <div className={cn("space-y-3", (courses.length > 0 || drinkRows.length > 0) && "mt-6 pt-5 border-t border-border/15")}>
                <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em]">
                  Equipment
                </span>
                {menu.equipment.filter(e => e.name).map((eq, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <p className="text-base font-serif text-foreground leading-snug flex-1">
                      <span>{eq.quantity > 1 ? `${eq.quantity} × ${eq.name}` : eq.name}</span>
                    </p>
                    {eq.pricePerUnit > 0 && (
                      <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                        {(eq.pricePerUnit * eq.quantity).toFixed(2)} €
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Personal */}
            {menu?.staff && menu.staff.filter(s => s.name).length > 0 && (
              <div className={cn("space-y-3", (courses.length > 0 || drinkRows.length > 0 || (menu?.equipment?.length ?? 0) > 0) && "mt-6 pt-5 border-t border-border/15")}>
                <span className="text-[10px] font-sans font-semibold text-primary/60 uppercase tracking-[0.15em]">
                  Personal
                </span>
                {menu.staff.filter(s => s.name).map((st, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <p className="text-base font-serif text-foreground leading-snug flex-1">
                      <span>{st.quantity > 1 ? `${st.quantity} × ${st.name}` : st.name}</span>
                    </p>
                    {st.pricePerUnit > 0 && (
                      <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                        {(st.pricePerUnit * st.quantity).toFixed(2)} €
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mengen-Stepper — nur bei Multi-Option-Modus sichtbar.
          Bei Single-Option ist die Menge automatisch durch inquiry.guest_count gesetzt. */}
      {!singleOption && (
      <div
        className="px-6 pb-5 pt-4 border-t border-border/10 bg-muted/10 flex items-center justify-between gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs font-sans font-medium text-foreground/80">
            Wie viele Gäste möchten dieses Menü?
          </p>
          <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
            Ergibt {formatCurrencyDecimal(quantity * perPersonPriceProp)} für diese Option
            {targetGuests !== null && remainingGuests !== null && remainingGuests > 0 && (
              <> · noch <strong>{remainingGuests}</strong> von <strong>{targetGuests}</strong> zu verteilen</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
            disabled={quantity <= 0}
            className="h-9 w-9 rounded-full"
            aria-label="Menge verringern"
          >
            −
          </Button>
          <Input
            type="number"
            min={0}
            max={targetGuests !== null ? quantity + (remainingGuests ?? 0) : undefined}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value || '0', 10);
              if (!isNaN(n) && n >= 0) {
                const cap = targetGuests !== null ? quantity + (remainingGuests ?? 0) : Infinity;
                onQuantityChange(Math.min(cap, n));
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-16 h-9 text-center rounded-full font-sans font-semibold"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              const cap = targetGuests !== null ? quantity + (remainingGuests ?? 0) : Infinity;
              onQuantityChange(Math.min(cap, quantity + 1));
            }}
            disabled={targetGuests !== null && (remainingGuests ?? 0) <= 0}
            className="h-9 w-9 rounded-full"
            aria-label="Menge erhöhen"
          >
            +
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
