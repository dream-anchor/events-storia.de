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

const FirmenfeierMuenchen = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Firmenfeier München – Team-Event im Italiener' : 'Corporate Event Munich – Team Event at Italian Restaurant'}
        description={language === 'de' 
          ? 'Firmenfeier München im STORIA: Team-Events, Weihnachtsfeiern & Business-Dinner in der Maxvorstadt. Italienisches Restaurant nahe Hauptbahnhof. Jetzt anfragen!'
          : 'Corporate event Munich at STORIA: Team events, Christmas parties & business dinners in Maxvorstadt. Italian restaurant near main station. Inquire now!'}
        canonical="/firmenfeier-muenchen"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Firmenfeier München' : 'Corporate Event Munich', url: '/firmenfeier-muenchen' }
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
              {language === 'de' ? 'Firmenfeier München – Team-Event im STORIA' : 'Corporate Event Munich – Team Event at STORIA'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Feiern Sie mit Ihrem Team im STORIA. Ob Weihnachtsfeier, Team-Building oder Business-Dinner – wir bieten den perfekten Rahmen für Ihre Firmenveranstaltung in der Maxvorstadt.'
                : 'Celebrate with your team at STORIA. Whether Christmas party, team building or business dinner – we offer the perfect setting for your corporate event in Maxvorstadt.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Unsere Angebote für Firmen' : 'Our Corporate Offerings'}
              </h2>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ {language === 'de' ? 'Weihnachtsfeiern mit festlichen Menüs' : 'Christmas parties with festive menus'}</li>
                <li>✓ {language === 'de' ? 'Team-Events & After-Work' : 'Team events & after-work'}</li>
                <li>✓ {language === 'de' ? 'Business-Dinner & Kundeneinladungen' : 'Business dinners & client invitations'}</li>
                <li>✓ {language === 'de' ? 'Sommerfeste auf der Terrasse' : 'Summer parties on the terrace'}</li>
                <li>✓ {language === 'de' ? 'Individuelle Menügestaltung' : 'Individual menu design'}</li>
              </ul>
            </div>

            <div className="bg-secondary/50 p-8 rounded-lg mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Warum STORIA für Ihre Firmenfeier?' : 'Why STORIA for Your Corporate Event?'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-muted-foreground">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{language === 'de' ? 'Zentrale Lage' : 'Central Location'}</h3>
                  <p>{language === 'de' ? 'Nur 5 Minuten vom Hauptbahnhof, ideal erreichbar für alle Mitarbeiter.' : 'Just 5 minutes from the main station, easily accessible for all employees.'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{language === 'de' ? 'Flexible Räumlichkeiten' : 'Flexible Spaces'}</h3>
                  <p>{language === 'de' ? 'Platz für kleine Teams bis große Abteilungen.' : 'Space for small teams to large departments.'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{language === 'de' ? 'Individuelle Betreuung' : 'Personal Service'}</h3>
                  <p>{language === 'de' ? 'Persönliche Planung und Beratung für Ihr Event.' : 'Personal planning and consultation for your event.'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{language === 'de' ? 'Authentische Küche' : 'Authentic Cuisine'}</h3>
                  <p>{language === 'de' ? 'Hochwertige italienische Küche, die begeistert.' : 'High-quality Italian cuisine that inspires.'}</p>
                </div>
              </div>
            </div>

            <div className="bg-card p-8 rounded-lg border border-border text-center mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Jetzt Firmenfeier planen' : 'Plan Your Corporate Event Now'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {language === 'de'
                  ? 'Kontaktieren Sie uns für ein unverbindliches Angebot.'
                  : 'Contact us for a non-binding offer.'}
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

export default FirmenfeierMuenchen;
