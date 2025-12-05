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
            alt="STORIA - Ristorante Pizzeria Bar München Logo" 
            className="h-32 md:h-48 mx-auto mb-6 hover:opacity-80 transition-opacity cursor-pointer"
          />
        </Link>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 tracking-widest uppercase">
          {t.hero.subtitle}
        </p>
        <h1 id="hero-heading" className="text-2xl md:text-3xl font-medium mb-10">
          {language === 'de' 
            ? 'Italienisches Restaurant in der Maxvorstadt' 
            : 'Italian Restaurant in Maxvorstadt'}
        </h1>
        <p className="sr-only">
          {language === 'de'
            ? 'STORIA – Ihr Italiener in der Maxvorstadt München nahe Königsplatz, TU München und Pinakotheken. Ristorante Pizzeria mit neapolitanischer Pizza aus dem Steinofen, hausgemachter Pasta und Aperitivo. Nur wenige Gehminuten vom Hauptbahnhof. La Storia – Trattoria München Karlstraße.'
            : 'STORIA – Your Italian restaurant in Maxvorstadt Munich near Königsplatz, TU Munich and Pinakothek museums. Ristorante Pizzeria with Neapolitan stone-oven pizza, homemade pasta and aperitivo. Just minutes from the main train station. La Storia – Italian trattoria Munich Karlstraße.'}
        </p>
        <Button 
          size="lg" 
          className="bg-primary text-primary-foreground hover:bg-accent transition-colors px-10 py-6 text-base tracking-widest uppercase"
          asChild
        >
          <a href="/reservierung">{t.hero.reserveButton}</a>
        </Button>
      </div>
    </section>
  );
};

export default Hero;
