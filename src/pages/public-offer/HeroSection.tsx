import { Calendar, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de, enUS, it, fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PublicInquiry, OfferPhase } from "./types";
import type { OfferLang } from "@/lib/offerLang";
import { tOffer } from "./i18n";

const LOCALES = { de, en: enUS, it, fr } as const;

export function HeroSection({
  inquiry,
  phase,
  lang = 'de',
}: {
  inquiry: PublicInquiry;
  phase: OfferPhase;
  lang?: OfferLang;
}) {
  const company = (inquiry.company_name ?? '').trim();
  const isPlaceholderCompany =
    !company || company.toLowerCase() === 'private';
  const displayName = isPlaceholderCompany ? inquiry.contact_name : company;
  const locale = LOCALES[lang] ?? de;

  const phaseConfig: Partial<Record<OfferPhase, { text: string; color: string }>> = {
    proposal_sent: { text: tOffer(lang, 'phaseProposal'), color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    customer_responded: { text: tOffer(lang, 'phaseResponded'), color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    final_sent: { text: tOffer(lang, 'phaseFinal'), color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    confirmed: { text: tOffer(lang, 'phaseConfirmed'), color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    paid: { text: tOffer(lang, 'phasePaid'), color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  };

  const badge = phaseConfig[phase];

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/80 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,0,0,0.03),transparent_50%)]" />

      <div className="relative container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-5">
            <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {tOffer(lang, 'heroEyebrow')}
            </p>
            {badge && (
              <span className={cn(
                "text-[10px] font-sans font-semibold px-2.5 py-1 rounded-full border",
                badge.color
              )}>
                {badge.text}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-8">
            {displayName}
          </h1>

          <div className="flex flex-wrap gap-3">
            {inquiry.preferred_date && (
              <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/40">
                <Calendar className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-sm font-sans font-medium text-foreground/80">
                  {inquiry.event_end_date
                    ? `${format(parseISO(inquiry.preferred_date), "d.", { locale })}–${format(parseISO(inquiry.event_end_date), "d. MMMM yyyy", { locale })}`
                    : format(parseISO(inquiry.preferred_date), "d. MMMM yyyy", { locale })}
                </span>
              </div>
            )}
            {inquiry.guest_count && (
              <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/40">
                <Users className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-sm font-sans font-medium text-foreground/80">
                  {inquiry.guest_count} {tOffer(lang, 'heroGuests')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}