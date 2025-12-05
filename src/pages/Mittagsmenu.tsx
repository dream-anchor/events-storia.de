import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MenuDisplay from "@/components/MenuDisplay";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ReservationCTA from "@/components/ReservationCTA";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Mittagsmenu = () => {
  const { t, language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Mittagsmenü – Lunch München Maxvorstadt' : 'Lunch Menu – Italian Lunch Munich'}
        description={language === 'de' 
          ? 'Mittagsmenü im STORIA München Maxvorstadt: Frische italienische Küche Mo-Fr zu attraktiven Preisen. Lunch nahe Hauptbahnhof & Königsplatz. Jetzt Mittagstisch genießen!'
          : 'Lunch menu at STORIA Munich Maxvorstadt: Fresh Italian cuisine Mon-Fri at great prices. Lunch near main station & Königsplatz. Enjoy your lunch break!'}
        canonical="/mittagsmenu"
      />
      <StructuredData 
        type="menu" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Mittagsmenü' : 'Lunch Menu', url: '/mittagsmenu' }
        ]} 
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <Link to="/">
              <img src={storiaLogo} alt="STORIA – Italienisches Restaurant München" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
            </Link>
            <p className="text-lg text-muted-foreground tracking-wide">
              {t.hero.subtitle}
            </p>
          </div>
        </div>
        <Navigation />

        <main className="container mx-auto px-4 py-12 flex-grow">
          <h1 className="text-4xl font-serif font-bold mb-6 text-center">
            {language === 'de' ? 'Mittagsmenü – Lunch München Maxvorstadt' : 'Lunch Menu – Italian Lunch Munich Maxvorstadt'}
          </h1>
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="text-xl font-serif italic text-primary mb-4">{t.lunchMenu.greeting}</p>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
              {t.lunchMenu.description}
            </p>
          </div>

          <MenuDisplay menuType="lunch" />
          
          <ReservationCTA />
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Mittagsmenu;
