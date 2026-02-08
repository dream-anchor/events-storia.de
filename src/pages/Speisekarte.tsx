import Header from "@/components/Header";
import { LocalizedLink } from "@/components/LocalizedLink";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MenuDisplay from "@/components/MenuDisplay";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";

import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Speisekarte = () => {
  const { t, language } = useLanguage();

  return (
    <>
      <SEO
        title={t.seo.speisekarte.title}
        description={t.seo.speisekarte.description}
      />
      <StructuredData 
        type="menu" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Speisekarte' : 'Menu', url: '/speisekarte' }
        ]} 
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <LocalizedLink to="home">
              <img src={storiaLogo} alt="STORIA – Italienisches Restaurant München" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
            </LocalizedLink>
            <p className="text-lg text-muted-foreground tracking-wide">
              {t.hero.subtitle}
            </p>
          </div>
        </div>
        <Navigation />

        <main className="container mx-auto px-4 py-12 flex-grow">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-center">
            {language === 'de' ? 'Speisekarte – Ristorante München Maxvorstadt' : 'Menu – Italian Restaurant Munich Maxvorstadt'}
          </h1>
          <p className="text-center text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            {language === 'de' 
              ? 'Authentische italienische Küche – neapolitanische Pizza aus dem Steinofen, hausgemachte Pasta und frische Antipasti. Frisch zubereitet mit Liebe und Leidenschaft.'
              : 'Authentic Italian cuisine – Neapolitan stone-oven pizza, homemade pasta and fresh antipasti. Freshly prepared with love and passion.'}
          </p>

          <MenuDisplay menuType="food" />
          
          
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Speisekarte;
