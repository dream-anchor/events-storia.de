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

const GeburtstagsfeierMuenchen = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Geburtstag feiern München – Party im Italiener' : 'Birthday Party Munich – Celebration at Italian Restaurant'}
        description={language === 'de' 
          ? 'Geburtstag feiern München im STORIA: Italienisches Restaurant in der Maxvorstadt für Ihre Geburtstagsfeier. Individuelle Menüs & stilvolles Ambiente. Jetzt reservieren!'
          : 'Birthday party Munich at STORIA: Italian restaurant in Maxvorstadt for your birthday celebration. Individual menus & stylish ambiance. Book now!'}
        canonical="/geburtstagsfeier-muenchen"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Geburtstagsfeier München' : 'Birthday Party Munich', url: '/geburtstagsfeier-muenchen' }
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
              {language === 'de' ? 'Geburtstag feiern München – Ihre Party im STORIA' : 'Birthday Party Munich – Your Celebration at STORIA'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Feiern Sie Ihren Geburtstag in besonderem Ambiente. Das STORIA bietet den perfekten Rahmen für unvergessliche Geburtstagsfeiern – von intim bis groß.'
                : 'Celebrate your birthday in a special ambiance. STORIA offers the perfect setting for unforgettable birthday parties – from intimate to large.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Ihre Geburtstagsfeier' : 'Your Birthday Party'}
              </h2>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ {language === 'de' ? 'Platz für 10 bis 60 Gäste' : 'Space for 10 to 60 guests'}</li>
                <li>✓ {language === 'de' ? 'Individuelle Menügestaltung' : 'Individual menu design'}</li>
                <li>✓ {language === 'de' ? 'Geburtstagstorte auf Wunsch' : 'Birthday cake on request'}</li>
                <li>✓ {language === 'de' ? 'Dekoration nach Absprache' : 'Decoration by arrangement'}</li>
                <li>✓ {language === 'de' ? 'Hausgemachtes Tiramisu als Highlight' : 'Homemade tiramisu as highlight'}</li>
              </ul>
            </div>

            <div className="bg-secondary/50 p-8 rounded-lg mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Tanti Auguri! – Geburtstag auf Italienisch' : 'Tanti Auguri! – Birthday Italian Style'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Im STORIA feiern wir Geburtstage mit italienischer Herzlichkeit. Lassen Sie sich und Ihre Gäste mit exquisiter Küche verwöhnen – von Pizza über Pasta bis zu feinen Dolci. Unser Team sorgt dafür, dass Ihr Ehrentag zu einem besonderen Erlebnis wird.'
                  : 'At STORIA, we celebrate birthdays with Italian warmth. Let yourself and your guests be pampered with exquisite cuisine – from pizza to pasta to fine dolci. Our team ensures your special day becomes an unforgettable experience.'}
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <Button asChild>
                  <Link to="/speisekarte">{language === 'de' ? 'Speisekarte ansehen' : 'View Menu'}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/kontakt">{language === 'de' ? 'Kontakt aufnehmen' : 'Get in Touch'}</Link>
                </Button>
              </div>
            </div>

            <div className="bg-card p-8 rounded-lg border border-border text-center mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Jetzt Geburtstag planen' : 'Plan Your Birthday Now'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {language === 'de'
                  ? 'Reservieren Sie frühzeitig für Ihre Geburtstagsfeier.'
                  : 'Book early for your birthday celebration.'}
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

export default GeburtstagsfeierMuenchen;
