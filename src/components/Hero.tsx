import { Link } from "react-router-dom";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { language } = useLanguage();

  return (
    <section className="bg-background" aria-labelledby="hero-heading">
      <div className="container mx-auto px-4 py-6 md:py-10 text-center animate-fade-in">
        <Link to="/" aria-label={language === 'de' ? 'Zur Startseite' : 'Go to homepage'}>
          <img 
            src={storiaLogo} 
            alt={language === 'de' ? 'STORIA Catering München Logo' : 'STORIA Catering Munich Logo'} 
            className="h-28 md:h-36 w-auto mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer"
            height="128"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
        
        {/* Elegante Tagline */}
        <p className="text-xs md:text-sm text-muted-foreground tracking-[0.3em] uppercase font-light mb-2">
          Catering · Events · Lieferservice
        </p>
        
        <h1 id="hero-heading" className="text-lg md:text-xl font-light text-foreground/80 tracking-wide mb-3">
          {language === 'de' 
            ? 'Italienische Küche für München' 
            : 'Italian Cuisine for Munich'}
        </h1>
        
      </div>
    </section>
  );
};

export default Hero;
