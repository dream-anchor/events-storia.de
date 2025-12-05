import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ReservationCTA from "@/components/ReservationCTA";
import { Button } from "@/components/ui/button";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const EventlocationMuenchen = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Eventlocation München Maxvorstadt – Restaurant für Events' : 'Event Location Munich Maxvorstadt – Restaurant for Events'}
        description={language === 'de' 
          ? 'Eventlocation München: STORIA in der Maxvorstadt für Ihre Veranstaltung. Italienisches Restaurant für Feiern, Events & Gruppen nahe Königsplatz. Jetzt anfragen!'
          : 'Event location Munich: STORIA in Maxvorstadt for your celebration. Italian restaurant for parties, events & groups near Königsplatz. Inquire now!'}
        canonical="/eventlocation-muenchen-maxvorstadt"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Eventlocation München' : 'Event Location Munich', url: '/eventlocation-muenchen-maxvorstadt' }
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
              RISTORANTE · PIZZERIA · BAR
            </p>
          </div>
        </div>
        <Navigation />
        
        <main className="container mx-auto px-4 py-12 flex-grow">
          <article className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-serif font-bold mb-6 text-center">
              {language === 'de' ? 'Eventlocation München Maxvorstadt – Ihr Restaurant für Events' : 'Event Location Munich Maxvorstadt – Your Restaurant for Events'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Das STORIA bietet den idealen Rahmen für Ihre Veranstaltung. Stilvolles Ambiente, exzellente italienische Küche und professioneller Service – zentral in der Maxvorstadt.'
                : 'STORIA offers the ideal setting for your event. Stylish ambiance, excellent Italian cuisine and professional service – central in Maxvorstadt.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Ihre Veranstaltung im STORIA' : 'Your Event at STORIA'}
              </h2>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ {language === 'de' ? 'Platz für Gruppen bis 60 Personen' : 'Space for groups up to 60 people'}</li>
                <li>✓ {language === 'de' ? 'Individuelle Menügestaltung' : 'Individual menu design'}</li>
                <li>✓ {language === 'de' ? 'Authentische italienische Küche' : 'Authentic Italian cuisine'}</li>
                <li>✓ {language === 'de' ? 'Professioneller Service' : 'Professional service'}</li>
                <li>✓ {language === 'de' ? 'Zentrale Lage mit guter Anbindung' : 'Central location with good transport links'}</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-secondary/50 p-6 rounded-lg">
                <h3 className="text-xl font-serif font-semibold mb-3">
                  {language === 'de' ? 'Ideal für' : 'Ideal for'}
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• {language === 'de' ? 'Firmenfeiern & Team-Events' : 'Corporate parties & team events'}</li>
                  <li>• {language === 'de' ? 'Geburtstage & Jubiläen' : 'Birthdays & anniversaries'}</li>
                  <li>• {language === 'de' ? 'Hochzeitsfeiern' : 'Wedding celebrations'}</li>
                  <li>• {language === 'de' ? 'Familienfeiern' : 'Family celebrations'}</li>
                </ul>
              </div>
              <div className="bg-secondary/50 p-6 rounded-lg">
                <h3 className="text-xl font-serif font-semibold mb-3">
                  {language === 'de' ? 'Lage & Erreichbarkeit' : 'Location & Accessibility'}
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• {language === 'de' ? 'Karlstraße 47a, Maxvorstadt' : 'Karlstraße 47a, Maxvorstadt'}</li>
                  <li>• {language === 'de' ? '5 Min. vom Hauptbahnhof' : '5 min from main station'}</li>
                  <li>• {language === 'de' ? 'Nahe Königsplatz & TU München' : 'Near Königsplatz & TU Munich'}</li>
                </ul>
              </div>
            </div>

            <div className="bg-card p-8 rounded-lg border border-border text-center mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Jetzt Anfragen' : 'Inquire Now'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {language === 'de'
                  ? 'Kontaktieren Sie uns für ein individuelles Angebot für Ihre Veranstaltung.'
                  : 'Contact us for a customized offer for your event.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <a href="tel:+498951519696">+49 89 51519696</a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="mailto:info@ristorantestoria.de">{language === 'de' ? 'E-Mail senden' : 'Send Email'}</a>
                </Button>
              </div>
            </div>

            <ReservationCTA />
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default EventlocationMuenchen;
