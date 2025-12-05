import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Clock, Instagram } from "lucide-react";
import domenicoImage from "@/assets/domenico-speranza.webp";
import storiaLogo from "@/assets/storia-logo.webp";
import nicolaImage from "@/assets/nicola-speranza.webp";
import mammaVideo from "@/assets/lamamma.mp4";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

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
                  alt="Domenico Speranza" 
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-lg font-serif italic tracking-wider text-primary-foreground/90">Domenico</p>
            </div>

            {/* Mamma */}
            <div className="text-center group">
              <div className="w-36 h-36 md:w-44 md:h-44 mx-auto mb-5 rounded-full overflow-hidden ring-1 ring-primary-foreground/20 shadow-xl transition-transform duration-300 group-hover:scale-105">
                <video 
                  src={mammaVideo}
                  autoPlay 
                  muted 
                  loop 
                  playsInline
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
                  alt="Nicola Speranza" 
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-lg font-serif italic tracking-wider text-primary-foreground/90">Nicola</p>
            </div>
          </div>
          
          {/* Discover Restaurant Link */}
          <Link 
            to="/ueber-uns"
            className="mt-10 inline-flex items-center gap-2 text-base font-serif italic text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors"
          >
            ~ {t.footer.discoverRestaurant} ~
          </Link>
        </div>
      </div>

      {/* Kontakt & Öffnungszeiten */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-center">
            {/* Kontakt */}
            <div className="space-y-4 text-center md:text-left">
              <h3 className="font-serif font-medium text-base tracking-[0.2em] uppercase mb-6 text-primary-foreground/90">{t.footer.contact}</h3>
              <div className="space-y-2.5 text-sm font-sans text-primary-foreground/60">
              <a href="tel:+498951519696" className="flex items-center justify-center md:justify-start gap-2.5 hover:text-primary-foreground transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                  +49 89 51519696
                </a>
                <a href="mailto:info@ristorantestoria.de" className="flex items-center justify-center md:justify-start gap-2.5 hover:text-primary-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5" />
                  info@ristorantestoria.de
                </a>
              <Link 
                  to="/kontakt#map" 
                  className="flex items-center justify-center md:justify-start gap-2.5 hover:text-primary-foreground transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Karlstr. 47a, 80333 München<br /><span className="text-xs opacity-70">Nähe Königsplatz & Hauptbahnhof</span></span>
                </Link>
              </div>
            </div>

            {/* STORIA Logo - Mitte */}
            <div className="flex flex-col items-center justify-center order-first md:order-none py-6 md:py-0">
              <img 
                src={storiaLogo}
                alt="STORIA"
                className="h-16 md:h-20 brightness-0 invert opacity-20"
              />
            </div>

            {/* Öffnungszeiten */}
            <div className="space-y-4 text-center md:text-right">
              <h3 className="font-serif font-medium text-base tracking-[0.2em] uppercase mb-6 text-primary-foreground/90">{t.footer.openingHours}</h3>
              <div className="space-y-1.5 text-sm font-sans text-primary-foreground/60">
                <div className="flex items-center justify-center md:justify-end gap-2.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t.footer.monFri}: 09:00 – 01:00</span>
                </div>
                <p>{t.footer.satSun}: 12:00 – 01:00</p>
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
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-xs font-sans text-primary-foreground/30">
            <Link to="/impressum" className="hover:text-primary-foreground/60 transition-colors">{t.footer.imprint}</Link>
            <span className="opacity-50">·</span>
            <Link to="/datenschutz" className="hover:text-primary-foreground/60 transition-colors">{t.footer.privacy}</Link>
            <span className="opacity-50">·</span>
            <Link to="/cookie-richtlinie" className="hover:text-primary-foreground/60 transition-colors">{t.legal.cookies}</Link>
            <span className="opacity-50">·</span>
            <Link to="/agb-restaurant" className="hover:text-primary-foreground/60 transition-colors">{t.legal.agb}</Link>
            <span className="opacity-50">·</span>
            <Link to="/lebensmittelhinweise" className="hover:text-primary-foreground/60 transition-colors">{t.legal.foodInfo}</Link>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs font-sans text-primary-foreground/20">
            <a 
              href="https://www.instagram.com/ristorante_storia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary-foreground/40 transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="h-3.5 w-3.5" />
            </a>
            <Link to="/admin" className="hover:text-primary-foreground/40 transition-colors">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
