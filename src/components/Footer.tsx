import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, Instagram, UtensilsCrossed, Truck, Home, ArrowRight } from "lucide-react";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t, language } = useLanguage();

  return (
    <footer className="bg-primary text-primary-foreground">
      {/* Service-Footer */}
      <div id="service-footer" className="border-b border-primary-foreground/10">
        <div className="container mx-auto px-4 py-16 md:py-20 text-center">
          {/* Überschrift */}
          <h2 className="text-3xl md:text-4xl font-serif font-semibold tracking-[0.15em] uppercase mb-4 text-primary-foreground">
            {t.footer.serviceTitle}
          </h2>
          
          {/* Subline */}
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-14 max-w-2xl mx-auto leading-relaxed">
            {t.footer.serviceSubline}
          </p>
          
          {/* 3 Leistungsanker */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14 max-w-4xl mx-auto mb-14">
            {/* Anker 1: Catering */}
            <div className="text-center">
              <UtensilsCrossed className="h-10 w-10 mx-auto mb-5 text-primary-foreground" strokeWidth={1.5} />
              <h3 className="font-serif font-semibold text-xl mb-2 text-primary-foreground">{t.footer.serviceCateringTitle}</h3>
              <p className="text-lg text-primary-foreground/70 leading-relaxed">{t.footer.serviceCateringDesc}</p>
            </div>
            
            {/* Anker 2: Lieferung */}
            <div className="text-center">
              <Truck className="h-10 w-10 mx-auto mb-5 text-primary-foreground" strokeWidth={1.5} />
              <h3 className="font-serif font-semibold text-xl mb-2 text-primary-foreground">{t.footer.serviceDeliveryTitle}</h3>
              <p className="text-lg text-primary-foreground/70 leading-relaxed">{t.footer.serviceDeliveryDesc}</p>
            </div>
            
            {/* Anker 3: Anlässe */}
            <div className="text-center">
              <Home className="h-10 w-10 mx-auto mb-5 text-primary-foreground" strokeWidth={1.5} />
              <h3 className="font-serif font-semibold text-xl mb-2 text-primary-foreground">{t.footer.serviceEventsTitle}</h3>
              <p className="text-lg text-primary-foreground/70 leading-relaxed">{t.footer.serviceEventsDesc}</p>
            </div>
          </div>
          
          {/* CTA Button */}
          <Link 
            to="/events#kontaktformular" 
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-primary-foreground/15 hover:bg-primary-foreground/25 rounded-lg transition-colors text-primary-foreground font-medium text-base"
          >
            {t.footer.serviceCta}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Kontakt & Lieferzeiten */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-start">
            {/* Kontakt */}
            <div className="text-center md:text-left">
              <h3 className="font-serif font-medium text-base tracking-[0.2em] uppercase mb-4 text-primary-foreground/90">{t.footer.contact}</h3>
              <div className="space-y-1 text-base font-sans text-primary-foreground/60">
                <a 
                  href="tel:+498951519696" 
                  className="flex items-center justify-center md:justify-start gap-2.5 min-h-[44px] md:min-h-0 py-2 hover:text-primary-foreground transition-colors touch-manipulation"
                >
                  <Phone className="h-4 w-4" />
                  +49 89 51519696
                </a>
                <a 
                  href="mailto:info@events-storia.de" 
                  className="flex items-center justify-center md:justify-start gap-2.5 min-h-[44px] md:min-h-0 py-2 hover:text-primary-foreground transition-colors touch-manipulation"
                >
                  <Mail className="h-4 w-4" />
                  info@events-storia.de
                </a>
                <Link 
                  to="/kontakt#map" 
                  className="flex items-center justify-center md:justify-start gap-2.5 min-h-[44px] md:min-h-0 py-2 hover:text-primary-foreground transition-colors touch-manipulation"
                >
                  <MapPin className="h-4 w-4" />
                  <span>
                    {language === 'de' ? 'Liefergebiet: München & Umgebung' : 'Delivery area: Munich & surroundings'}
                  </span>
                </Link>
              </div>
            </div>

            {/* STORIA Logo - Mitte */}
            <div className="flex flex-col items-center justify-center order-first md:order-none py-6 md:py-0">
              <img 
                src={storiaLogo}
                alt="STORIA Catering München Logo"
                className="h-20 md:h-24 w-auto brightness-0 invert opacity-20"
                height="96"
                loading="lazy"
                decoding="async"
              />
            </div>

            {/* Lieferzeiten */}
            <div className="text-center md:text-right">
              <h3 className="font-serif font-medium text-base tracking-[0.2em] uppercase mb-4 text-primary-foreground/90">
                {language === 'de' ? 'Lieferzeiten' : 'Delivery Hours'}
              </h3>
              <div className="space-y-1 text-base font-sans text-primary-foreground/60">
                <div className="flex items-center justify-center md:justify-end gap-2.5 min-h-[44px] md:min-h-0 py-2">
                  <Clock className="h-4 w-4" />
                  <span>{language === 'de' ? 'Mo - Fr' : 'Mon - Fri'}: 09:00 – 01:00</span>
                </div>
                <div className="flex items-center justify-center md:justify-end gap-2.5 min-h-[44px] md:min-h-0 py-2">
                  <Clock className="h-4 w-4 opacity-0" />
                  <span>{language === 'de' ? 'Sa - So' : 'Sat - Sun'}: 12:00 – 01:00</span>
                </div>
                <div className="flex items-center justify-center md:justify-end gap-2.5 min-h-[44px] md:min-h-0 py-2">
                  <span className="h-4 w-4" />
                  <span className="italic text-primary-foreground/70">{t.footer.welcomeMessage}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright & Legal */}
        <div className="border-t border-primary-foreground/5 mt-14 pt-10 text-center">
          <p className="text-sm font-sans text-primary-foreground/40">
            © {new Date().getFullYear()} {t.footer.copyright}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 mt-6 text-sm font-sans text-primary-foreground/40">
            <Link to="/impressum" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.footer.imprint}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/datenschutz" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.footer.privacy}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/cookie-richtlinie" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.legal.cookies}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/agb-catering" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{language === 'de' ? 'AGB Catering' : 'Catering Terms'}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/widerrufsbelehrung" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{language === 'de' ? 'Widerrufsbelehrung' : 'Cancellation Policy'}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/lebensmittelhinweise" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.legal.foodInfo}</Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm font-sans text-primary-foreground/30">
            <a 
              href="https://www.instagram.com/ristorante_storia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center hover:text-primary-foreground/50 transition-colors touch-manipulation"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <Link to="/admin" className="py-2 min-h-[44px] md:min-h-0 inline-flex items-center hover:text-primary-foreground/50 transition-colors touch-manipulation">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
