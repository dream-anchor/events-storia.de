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

const Getraenke = () => {
  const { t, language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Getränkekarte – Aperitivo München' : 'Drinks Menu – Aperitivo Munich'}
        description={language === 'de' 
          ? 'Getränkekarte STORIA: Aperitivo München, italienische Weine & Cocktails. Late Night Aperitivo 21-22:30 Uhr. Bar in der Maxvorstadt. Jetzt Tisch reservieren!'
          : 'STORIA drinks menu: Aperitivo Munich, Italian wines & cocktails. Late Night Aperitivo 9-10:30 PM. Bar in Maxvorstadt. Book your table now!'}
        canonical="/getraenke"
      />
      <StructuredData 
        type="menu" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Getränke' : 'Drinks', url: '/getraenke' }
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
          <h1 className="text-4xl font-serif font-bold mb-4 text-center">
            {language === 'de' ? 'Getränkekarte – Aperitivo & Weine in München' : 'Drinks Menu – Aperitivo & Wines in Munich'}
          </h1>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            {language === 'de'
              ? 'Erlesene italienische Weine, klassische Cocktails und Late Night Aperitivo in stilvollem Ambiente.'
              : 'Exquisite Italian wines, classic cocktails and Late Night Aperitivo in a stylish atmosphere.'}
          </p>

          <MenuDisplay menuType="drinks" />
          
          <ReservationCTA />
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Getraenke;
