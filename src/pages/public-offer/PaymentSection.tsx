import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PublicPayment } from "./types";

export function PublicPaymentSection({
  payments,
  eventDate,
}: {
  payments: PublicPayment[];
  eventDate?: string;
}) {
  if (!payments.length) return null;

  const typeLabels: Record<string, string> = {
    deposit: "Anzahlung",
    prepayment: "Vorauszahlung",
    final: "Restzahlung",
  };

  const fmt = (cents: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

  const fmtDate = (iso: string | null | Date) => {
    if (!iso) return null;
    try {
      return format(typeof iso === "string" ? parseISO(iso) : iso, "d. MMMM yyyy", { locale: de });
    } catch {
      return null;
    }
  };

  const effectiveDueDate = (p: PublicPayment): Date | null => {
    if (p.due_date) return parseISO(p.due_date);
    if (p.due_days_before_event && eventDate) {
      const d = parseISO(eventDate);
      d.setDate(d.getDate() - p.due_days_before_event);
      return d;
    }
    return null;
  };

  const allPaid = payments.every((p) => p.status === "paid");
  const hasOverdue = payments.some((p) => p.status === "overdue");
  const firstOpen = payments.find((p) => p.status !== "paid");
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount_cents, 0);

  const headerIcon = allPaid ? "✅" : hasOverdue ? "⚠️" : "💰";
  const headerText = allPaid
    ? "Ihre Zahlungen"
    : hasOverdue
    ? "Offene Zahlung"
    : "Ihre Zahlungen";

  return (
    <section className="bg-background border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl">
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
            Zahlungen
          </p>
          <h2 className="font-serif text-xl md:text-2xl font-bold mb-6">
            {headerIcon} {headerText}
          </h2>

          <div className="space-y-3 mb-6">
            {payments.map((p) => {
              const due = effectiveDueDate(p);
              const isPaid = p.status === "paid";
              const isOverdue = p.status === "overdue";
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between gap-4 py-3 px-4 rounded-xl border",
                    isPaid
                      ? "bg-emerald-50 border-emerald-200/60"
                      : isOverdue
                      ? "bg-amber-50 border-amber-200/60"
                      : "bg-white/60 border-border/40"
                  )}
                >
                  <div>
                    <p className="font-sans font-semibold text-sm text-foreground">
                      {typeLabels[p.payment_type] ?? p.payment_type}
                    </p>
                    <p className="text-xs font-sans text-muted-foreground mt-0.5">
                      {isPaid
                        ? `Bezahlt am ${fmtDate(p.paid_at) ?? "—"}`
                        : isOverdue
                        ? `Fällig seit ${fmtDate(due) ?? "—"}`
                        : due
                        ? `Fällig bis ${fmtDate(due)}`
                        : "Fälligkeit wird mitgeteilt"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-sans font-bold text-sm text-foreground">{fmt(p.amount_cents)}</p>
                    {isPaid && <p className="text-xs text-emerald-600 font-sans">✓ Eingegangen</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {allPaid && (
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-6">
              <p className="font-sans font-semibold text-sm text-emerald-800">Gesamt bezahlt</p>
              <p className="font-sans font-bold text-sm text-emerald-800">{fmt(totalPaid)}</p>
            </div>
          )}

          {!allPaid && firstOpen?.stripe_payment_link_url && (
            <a
              href={firstOpen.stripe_payment_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <button className="w-full py-4 px-6 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white font-sans font-semibold text-base shadow-[0_4px_15px_rgba(180,83,9,0.25)] hover:shadow-[0_8px_25px_rgba(180,83,9,0.35)] hover:-translate-y-0.5 transition-all flex flex-col items-center gap-1">
                <span>
                  {typeLabels[firstOpen.payment_type] ?? "Zahlung"} jetzt bezahlen →
                </span>
                <span className="text-xs font-normal opacity-80">Karte · SEPA · Billie</span>
              </button>
            </a>
          )}

          {allPaid && (
            <p className="text-sm font-sans text-muted-foreground">
              Vielen Dank! Alle Zahlungen sind eingegangen. Wir freuen uns auf Ihr Event.
            </p>
          )}

          {!allPaid && firstOpen && !firstOpen.stripe_payment_link_url && (
            <p className="text-sm font-sans text-muted-foreground">
              Bei Fragen zur Zahlung erreichen Sie uns unter{" "}
              <a href="tel:+498951519696" className="text-primary hover:underline">089 51519696</a>{" "}
              oder{" "}
              <a href="mailto:info@events-storia.de" className="text-primary hover:underline">info@events-storia.de</a>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}