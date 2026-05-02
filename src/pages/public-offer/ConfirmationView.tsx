import { CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { PublicInquiry, PublicOfferOption } from "./types";
import { formatCurrency, formatCurrencyDecimal } from "./types";

export function ConfirmationView({
  inquiry,
  options,
}: {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}) {
  const selectedOption = inquiry.selected_option_id
    ? options.find((o) => o.id === inquiry.selected_option_id)
    : options[0];

  const isPerEvent = selectedOption?.menu_selection?.pricingMode === 'per_event';
  const pricePerPerson = isPerEvent
    ? 0
    : selectedOption && selectedOption.guest_count > 0
      ? (selectedOption.menu_selection?.budgetPerPerson && selectedOption.menu_selection.budgetPerPerson > 0
          ? selectedOption.menu_selection.budgetPerPerson
          : selectedOption.total_amount / selectedOption.guest_count)
      : 0;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-lg">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-8">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-5">
            Buchung bestätigt!
          </h2>
          {selectedOption && (
            <p className="text-muted-foreground font-sans mb-2">
              <strong className="text-foreground">{selectedOption.package_name}</strong>
              {" "}für {selectedOption.guest_count} Gäste —{" "}
              {pricePerPerson > 0
                ? `${formatCurrencyDecimal(pricePerPerson)} pro Person`
                : `${formatCurrency(selectedOption.total_amount)} Gesamtpreis`}
            </p>
          )}
          {inquiry.preferred_date && (
            <p className="text-lg font-serif font-semibold text-foreground mb-2">
              {inquiry.event_end_date
                ? `${format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM", { locale: de })} – ${format(parseISO(inquiry.event_end_date), "d. MMMM yyyy", { locale: de })}`
                : format(parseISO(inquiry.preferred_date), "EEEE, d. MMMM yyyy", { locale: de })}
            </p>
          )}
          <p className="text-muted-foreground font-sans mt-6">
            Wir freuen uns auf Ihr Event! Bei Fragen erreichen Sie uns jederzeit.
          </p>
        </div>
      </div>
    </section>
  );
}