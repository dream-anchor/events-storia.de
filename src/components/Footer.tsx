import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, Instagram } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import domenicoImage from "@/assets/domenico-speranza.webp";
import storiaLogo from "@/assets/storia-logo.webp";
import nicolaImage from "@/assets/nicola-speranza.webp";
import mammaVideo from "@/assets/lamamma.mp4";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t, language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  // Lazy load video when visible
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVideoVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <footer className="bg-primary text-primary-foreground">
      {/* La Famiglia Speranza */}
      <div id="la-famiglia" className="border-b border-primary-foreground/5">
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-xl md:text-2xl font-serif font-medium tracking-[0.3em] uppercase mb-14 text-primary-foreground/90">{t.footer.theFamily}</h2>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-14 md:gap-20">
            {/* Domenico */}
            <div className="text-center group">
              <div className="w-36 h-36 md:w-44 md:h-44 mx-auto mb-5 rounded-full overflow-hidden ring-1 ring-primary-foreground/20 shadow-xl transition-transform duration-300 group-hover:scale-105">
              <img 
                  src={domenicoImage} 
                  alt="Domenico Speranza – STORIA München" 
                  className="w-full h-full object-cover"
                  width="176"
                  height="176"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="text-lg font-serif italic tracking-wider text-primary-foreground/90">Domenico</p>
            </div>

            {/* Mamma */}
            <div className="text-center group">
              <div className="w-36 h-36 md:w-44 md:h-44 mx-auto mb-5 rounded-full overflow-hidden ring-1 ring-primary-foreground/20 shadow-xl transition-transform duration-300 group-hover:scale-105">
                <video 
                  ref={videoRef}
                  src={isVideoVisible ? mammaVideo : undefined}
                  autoPlay={isVideoVisible}
                  muted 
                  loop 
                  playsInline
                  preload="none"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-lg font-serif italic tracking-wider text-primary-foreground/90">Mamma</p>
            </div>

            {/* Nicola */}
            <div className="text-center group">
              <div className="w-36 h-36 md:w-44 md:h-44 mx-auto mb-5 rounded-full overflow-hidden ring-1 ring-primary-foreground/20 shadow-xl transition-transform duration-300 group-hover:scale-105">
              <img 
                  src={nicolaImage} 
                  alt="Nicola Speranza – STORIA München" 
                  className="w-full h-full object-cover"
                  width="176"
                  height="176"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="text-lg font-serif italic tracking-wider text-primary-foreground/90">Nicola</p>
            </div>
          </div>
        </div>
      </div>

      {/* Kontakt & Lieferzeiten */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
            {/* Kontakt */}
            <div className="space-y-4 text-center md:text-left">
              <h3 className="font-serif font-medium text-base tracking-[0.2em] uppercase mb-6 text-primary-foreground/90">{t.footer.contact}</h3>
              <div className="space-y-1 text-sm font-sans text-primary-foreground/60">
                <a 
                  href="tel:+498951519696" 
                  className="flex items-center justify-center md:justify-start gap-2.5 min-h-[44px] md:min-h-0 py-2 hover:text-primary-foreground transition-colors touch-manipulation"
                >
                  <Phone className="h-4 w-4" />
                  +49 89 51519696
                </a>
                <a 
                  href="mailto:info@ristorantestoria.de" 
                  className="flex items-center justify-center md:justify-start gap-2.5 min-h-[44px] md:min-h-0 py-2 hover:text-primary-foreground transition-colors touch-manipulation"
                >
                  <Mail className="h-4 w-4" />
                  info@ristorantestoria.de
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
            <div className="space-y-4 text-center md:text-right">
              <h3 className="font-serif font-medium text-base tracking-[0.2em] uppercase mb-6 text-primary-foreground/90">{t.footer.openingHours}</h3>
              <div className="space-y-1.5 text-sm font-sans text-primary-foreground/60">
                <div className="flex items-center justify-center md:justify-end gap-2.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t.footer.monFri}: 09:00 – 20:00</span>
                </div>
                <p>{t.footer.satSun}: {language === 'de' ? 'auf Anfrage' : 'on request'}</p>
                <p className="pt-2 italic text-primary-foreground/70">{t.footer.welcomeMessage}</p>
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
            <Link to="/impressum" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.footer.imprint}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/datenschutz" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.footer.privacy}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/cookie-richtlinie" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.legal.cookies}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/agb-catering" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{language === 'de' ? 'AGB Catering' : 'Catering Terms'}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/widerrufsbelehrung" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{language === 'de' ? 'Widerrufsbelehrung' : 'Cancellation Policy'}</Link>
            <span className="opacity-50 hidden sm:inline">·</span>
            <Link to="/lebensmittelhinweise" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/70 transition-colors touch-manipulation">{t.legal.foodInfo}</Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm font-sans text-primary-foreground/30">
            <a 
              href="https://www.instagram.com/ristorante_storia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-primary-foreground/50 transition-colors touch-manipulation"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <Link to="/admin" className="py-2 min-h-[44px] inline-flex items-center hover:text-primary-foreground/50 transition-colors touch-manipulation">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
