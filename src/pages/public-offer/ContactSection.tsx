import { useState } from "react";
import { Phone, Mail, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LocalizedLink } from "@/components/LocalizedLink";
import { cn } from "@/lib/utils";
import { tOffer } from "./i18n";
import type { OfferLang } from "@/lib/offerLang";

export function CancellationTermsAccordion({ lang = 'de' }: { lang?: OfferLang } = {}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-border/40 pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 text-sm font-sans text-foreground/70 hover:text-foreground transition-colors group"
      >
        <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
        <span className="flex-1 text-left font-medium">{tOffer(lang, 'cancelHeadline')}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-4 px-1 space-y-3 text-sm font-sans animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p className="text-foreground/80 leading-relaxed">
            {tOffer(lang, 'cancelIntro')}
          </p>

          <ul className="space-y-2 pt-1">
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">{tOffer(lang, 'cancelRow1')}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{tOffer(lang, 'cancelFree')}</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">{tOffer(lang, 'cancelRow2')}</span>
              <span className="font-semibold text-foreground whitespace-nowrap">{tOffer(lang, 'cancelPct35')}</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-foreground">{tOffer(lang, 'cancelRow3')}</span>
              <span className="font-semibold text-foreground whitespace-nowrap">{tOffer(lang, 'cancelPct70')}</span>
            </li>
          </ul>

          <p className="pt-2 text-xs text-muted-foreground leading-relaxed">
            {tOffer(lang, 'cancelDetailedFooter')}{" "}
            <LocalizedLink
              to="legal.terms"
              lang={lang === 'de' ? 'de' : 'en'}
              target="_blank"
              className="underline hover:text-foreground"
            >
              {tOffer(lang, 'cancelTermsLink')}
            </LocalizedLink>.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Pflicht-Checkbox vor der Online-Zahlung eines Angebots (Angebotsannahme + AGB inkl. Stornobedingungen).
 * Die Zahlungs-Schaltflächen bleiben deaktiviert, bis `checked` true ist.
 */
export function OfferTermsAcceptance({
  lang = 'de',
  checked,
  onCheckedChange,
  id = 'offer-agb-accept',
}: {
  lang?: OfferLang;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4 text-left">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
        aria-required="true"
      />
      <label htmlFor={id} className="text-sm font-sans leading-relaxed text-foreground/85 cursor-pointer">
        {tOffer(lang, 'payAcceptPrefix')}{" "}
        <LocalizedLink
          to="legal.terms"
          lang={lang === 'de' ? 'de' : 'en'}
          target="_blank"
          className="underline hover:text-foreground"
        >
          {tOffer(lang, 'payAcceptLink')}
        </LocalizedLink>{" "}
        {tOffer(lang, 'payAcceptSuffix')} *
      </label>
    </div>
  );
}

export function ContactSection({ lang = 'de' }: { lang?: OfferLang } = {}) {
  return (
    <section className="border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
          {tOffer(lang, 'contactEyebrow')}
        </p>
        <h2 className="text-xl md:text-2xl font-serif font-bold mb-3">
          {tOffer(lang, 'contactTitle')}
        </h2>
        <p className="text-muted-foreground font-sans mb-8 max-w-md text-sm">
          {tOffer(lang, 'contactSubtitle')}
        </p>
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <a href="tel:+498951519696">
            <Button variant="outline" className="gap-2 rounded-full font-sans px-6 h-11 hover:-translate-y-0.5 transition-all">
              <Phone className="h-4 w-4" />
              +49 89 51519696
            </Button>
          </a>
          <a href="mailto:info@events-storia.de">
            <Button variant="outline" className="gap-2 rounded-full font-sans px-6 h-11 hover:-translate-y-0.5 transition-all">
              <Mail className="h-4 w-4" />
              info@events-storia.de
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}