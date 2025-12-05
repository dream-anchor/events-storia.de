import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t, language } = useLanguage();

  return (
    <section className="bg-background border-b border-border" aria-labelledby="hero-heading">
      <div className="container mx-auto px-4 py-16 md:py-24 text-center">
        <Link to="/" aria-label={language === 'de' ? 'Zur Startseite' : 'Go to homepage'}>
          <img 
            src={storiaLogo} 
            alt="STORIA Catering München Logo" 
            className="h-32 md:h-48 mx-auto mb-6 hover:opacity-80 transition-opacity cursor-pointer"
          />
        </Link>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 tracking-widest uppercase">
          {t.hero.subtitle}
        </p>
        <h1 id="hero-heading" className="text-2xl md:text-3xl font-medium mb-6">
          {language === 'de' 
            ? 'Italienisches Catering für Events, Büro & Zuhause' 
            : 'Italian Catering for Events, Office & Home'}
        </h1>
        <p className="text-lg text-muted-foreground mb-4 max-w-2xl mx-auto">
          {language === 'de'
            ? 'Frisch gekocht, stilvoll angerichtet und flexibel geliefert – überall in München und Umgebung.'
            : 'Freshly prepared, elegantly presented and flexibly delivered – throughout Munich and surrounding areas.'}
        </p>
        <p className="text-base text-muted-foreground mb-10 max-w-3xl mx-auto">
          {language === 'de'
            ? 'Ob Firmenfeier, Team-Lunch, Meeting, Geburtstagsessen oder einfach ein Genussmoment zu Hause – wir bringen italienische Küche dorthin, wo Sie sie brauchen. Frisch, unkompliziert und individuell kombinierbar.'
            : 'Whether corporate celebration, team lunch, meeting, birthday dinner or simply a gourmet moment at home – we bring Italian cuisine wherever you need it. Fresh, uncomplicated and individually customizable.'}
        </p>
        <p className="sr-only">
          {language === 'de'
            ? 'STORIA Catering München – Italienisches Catering für Events, Büro und Zuhause. Fingerfood, Pizza, Pasta, Antipasti und mehr. Frisch zubereitet und flexibel geliefert in München und Umgebung.'
            : 'STORIA Catering Munich – Italian catering for events, office and home. Finger food, pizza, pasta, antipasti and more. Freshly prepared and flexibly delivered in Munich and surrounding areas.'}
        </p>
        <Button 
          size="lg" 
          className="bg-primary text-primary-foreground hover:bg-accent transition-colors px-10 py-6 text-base tracking-widest uppercase"
          asChild
        >
          <Link to="/kontakt">{t.hero.reserveButton}</Link>
        </Button>
      </div>
    </section>
  );
};

export default Hero;
