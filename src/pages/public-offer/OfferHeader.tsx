import { Phone, Mail } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";

export function OfferHeader() {
  return (
    <header className="border-b border-border/30 bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <LocalizedLink
            to="home"
            className="font-display text-xl md:text-2xl font-bold tracking-wide hover:opacity-80 transition-opacity"
          >
            STORIA
          </LocalizedLink>
          <div className="flex items-center gap-1 md:gap-4">
            <a
              href="tel:+498951519696"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 text-foreground/70 hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden md:inline text-sm font-sans font-medium">+49 89 51519696</span>
            </a>
            <a
              href="mailto:info@events-storia.de"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 text-foreground/70 hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden md:inline text-sm font-sans font-medium">info@events-storia.de</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

export function OfferFooter() {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl font-bold tracking-wide mb-1">STORIA</p>
            <p className="text-sm text-background/50 font-sans">
              Catering & Events — München
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-background/50 font-sans">
            <a
              href="tel:+498951519696"
              className="hover:text-background/80 transition-colors flex items-center gap-2"
            >
              <Phone className="h-3.5 w-3.5" />
              +49 89 51519696
            </a>
            <a
              href="mailto:info@events-storia.de"
              className="hover:text-background/80 transition-colors flex items-center gap-2"
            >
              <Mail className="h-3.5 w-3.5" />
              info@events-storia.de
            </a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-background/10 text-center text-xs text-background/30 font-sans">
          <p>&copy; {new Date().getFullYear()} STORIA Catering & Events</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <LocalizedLink
              to="legal.imprint"
              className="hover:text-background/60 transition-colors"
            >
              Impressum
            </LocalizedLink>
            <LocalizedLink
              to="legal.privacy"
              className="hover:text-background/60 transition-colors"
            >
              Datenschutz
            </LocalizedLink>
          </div>
        </div>
      </div>
    </footer>
  );
}