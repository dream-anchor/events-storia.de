import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";
import { LocalizedLink } from "@/components/LocalizedLink";

const Hero = () => {
  const { language } = useLanguage();

  return (
    <section className="bg-background" aria-labelledby="hero-heading">
      <div className="container mx-auto px-4 pt-10 md:pt-16 pb-4 md:pb-6 text-center animate-fade-in">
        <LocalizedLink to="home" aria-label={language === 'de' ? 'Zur Startseite' : 'Go to homepage'}>
          <img
            src={storiaLogo}
            alt={language === 'de' ? 'STORIA Catering München Logo' : 'STORIA Catering Munich Logo'}
            className="h-32 md:h-40 w-auto mx-auto mb-6 md:mb-8 drop-shadow-sm hover:drop-shadow-md transition-all duration-300 cursor-pointer"
            width="200"
            height="160"
            fetchPriority="high"
            decoding="async"
          />
        </LocalizedLink>
        
        {/* Elegante Tagline */}
        <p className="font-display text-sm md:text-base text-muted-foreground tracking-[0.25em] uppercase mb-2">
          Catering · Events · Lieferservice
        </p>
        
        <h1 id="hero-heading" className="font-display text-lg md:text-xl text-foreground/80 tracking-wide mb-3">
          {language === 'de'
            ? 'Italienisches Catering in München'
            : 'Italian Catering in Munich'}
        </h1>
        
      </div>
    </section>
  );
};

export default Hero;
