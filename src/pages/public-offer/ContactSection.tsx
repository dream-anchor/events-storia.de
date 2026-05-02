import { useState } from "react";
import { Phone, Mail, Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { cn } from "@/lib/utils";

export function CancellationTermsAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-border/40 pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 text-sm font-sans text-foreground/70 hover:text-foreground transition-colors group"
      >
        <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
        <span className="flex-1 text-left font-medium">Flexibel stornieren — bis 30 Tage vor dem Event kostenfrei</span>
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
            Pläne können sich ändern — wir verstehen das. Falls Sie Ihr Event absagen müssen,
            gelten folgende Stornogebühren (berechnet als Anteil der gebuchten Summe):
          </p>

          <ul className="space-y-2 pt-1">
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">Mehr als 30 Tage vor dem Event</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">kostenlos</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">15–30 Tage vor dem Event</span>
              <span className="font-semibold text-foreground whitespace-nowrap">25 %</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">8–14 Tage vor dem Event</span>
              <span className="font-semibold text-foreground whitespace-nowrap">50 %</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20">
              <span className="text-foreground">3–7 Tage vor dem Event</span>
              <span className="font-semibold text-foreground whitespace-nowrap">80 %</span>
            </li>
            <li className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-foreground">Ab 48 Stunden vorher oder No-Show</span>
              <span className="font-semibold text-foreground whitespace-nowrap">100 %</span>
            </li>
          </ul>

          <p className="pt-2 text-xs text-muted-foreground leading-relaxed">
            Maßgeblich ist der Eingang Ihrer schriftlichen Stornierung bei uns.
            Bereits geleistete Anzahlungen werden mit der Stornogebühr verrechnet —
            ein etwaiger Überschuss wird Ihnen zurückerstattet.
            Vollständige Bedingungen finden Sie in unseren{" "}
            <LocalizedLink to="/agb-veranstaltungen" className="underline hover:text-foreground">
              AGB für Veranstaltungen
            </LocalizedLink>.
          </p>
        </div>
      )}
    </div>
  );
}

export function ContactSection() {
  return (
    <section className="border-t border-border/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary/60 mb-3">
          Kontakt
        </p>
        <h2 className="text-xl md:text-2xl font-serif font-bold mb-3">
          Fragen zu Ihrem Angebot?
        </h2>
        <p className="text-muted-foreground font-sans mb-8 max-w-md text-sm">
          Wir beraten Sie gerne persönlich und passen das Angebot an Ihre Wünsche an.
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