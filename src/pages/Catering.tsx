import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ReservationCTA from "@/components/ReservationCTA";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Catering = () => {
  const { t, language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Catering & Events – Eventlocation München' : 'Catering & Events – Event Location Munich'}
        description={language === 'de' 
          ? 'Italienisches Catering München & Eventlocation Maxvorstadt: Firmenfeiern, Hochzeiten, Geburtstage. STORIA – Ihr Partner für unvergessliche Events!'
          : 'Italian catering Munich & event location Maxvorstadt: Corporate events, weddings, birthdays. STORIA – your partner for unforgettable events!'}
        canonical="/catering"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Catering & Events', url: '/catering' }
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
          <h1 className="text-4xl font-bold mb-4 text-center">
            {language === 'de' ? 'Catering & Events – Eventlocation München Maxvorstadt' : 'Catering & Events – Event Location Munich Maxvorstadt'}
          </h1>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            {language === 'de'
              ? 'Italienisches Catering und stilvolle Eventlocation in der Maxvorstadt – perfekt für Firmenfeiern, Hochzeiten und private Anlässe.'
              : 'Italian catering and stylish event location in Maxvorstadt – perfect for corporate events, weddings and private occasions.'}
          </p>
          
          <div className="max-w-4xl mx-auto">
            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-3xl font-serif font-bold mb-4">{t.catering.yourEvent}</h2>
              <p className="text-lg text-muted-foreground mb-6">
                {t.catering.eventDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-card p-6 rounded-lg border border-border">
                <h2 className="text-2xl font-serif font-bold mb-4">{t.catering.cateringTitle}</h2>
                <p className="text-muted-foreground mb-4">
                  {t.catering.cateringDesc}
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>{t.catering.antipastiPlatters}</li>
                  <li>{t.catering.freshPizzaPasta}</li>
                  <li>{t.catering.italianBuffets}</li>
                  <li>{t.catering.dolciDesserts}</li>
                </ul>
              </div>

              <div className="bg-card p-6 rounded-lg border border-border">
                <h2 className="text-2xl font-serif font-bold mb-4">{t.catering.privateEvents}</h2>
                <p className="text-muted-foreground mb-4">
                  {t.catering.privateEventsDesc}
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>{t.catering.birthdays}</li>
                  <li>{t.catering.corporateEvents}</li>
                  <li>{t.catering.weddings}</li>
                  <li>{t.catering.familyCelebrations}</li>
                </ul>
              </div>
            </div>

            <div className="bg-secondary p-8 rounded-lg text-center">
              <h2 className="text-2xl font-bold mb-4">{t.catering.interested}</h2>
              <p className="text-muted-foreground mb-6">
                {t.catering.contactUs}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <a href="tel:+498951519696">+49 89 51519696</a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="mailto:info@ristorantestoria.de">{t.catering.sendEmail}</a>
                </Button>
              </div>
            </div>

            <ReservationCTA />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Catering;
