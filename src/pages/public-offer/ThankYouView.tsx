import { CheckCircle2 } from "lucide-react";
import type { CustomerResponseData, PublicOfferOption } from "./types";
import { tOffer } from "./i18n";
import type { OfferLang } from "@/lib/offerLang";

export function ThankYouView({
  customerResponse,
  options,
  lang = 'de',
}: {
  customerResponse: CustomerResponseData | null;
  options: PublicOfferOption[];
  lang?: OfferLang;
}) {
  const selectedOption = customerResponse?.selected_option_id
    ? options.find((o) => o.id === customerResponse.selected_option_id)
    : null;

  return (
    <section className="bg-secondary/30">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-lg">
          <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-8">
            <CheckCircle2 className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">
            {tOffer(lang, 'thankTitle')}
          </h2>
          {selectedOption && (
            <p className="text-muted-foreground font-sans mb-2">
              {tOffer(lang, 'thankChose')}{" "}
              <strong className="text-foreground">
                {selectedOption.package_name}
              </strong>{" "}
              {tOffer(lang, 'thankChoseSuffix')}
            </p>
          )}
          {customerResponse?.customer_notes && (
            <div className="bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 mt-6 mb-6 text-left border border-white/40">
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                {tOffer(lang, 'thankNote')}
              </p>
              <p className="text-sm font-sans text-foreground whitespace-pre-wrap">
                {customerResponse.customer_notes}
              </p>
            </div>
          )}
          <p className="text-muted-foreground font-sans">
            {tOffer(lang, 'thankFollowUp')}
          </p>
        </div>
      </div>
    </section>
  );
}