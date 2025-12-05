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

const RomantischesDinner = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Romantisches Dinner München – Date Night Italiener' : 'Romantic Dinner Munich – Date Night Italian'}
        description={language === 'de' 
          ? 'Romantisches Dinner München im STORIA: Date Night im italienischen Ambiente. Candlelight, exquisite Küche & Weine in der Maxvorstadt. Jetzt Tisch reservieren!'
          : 'Romantic dinner Munich at STORIA: Date night in Italian ambiance. Candlelight, exquisite cuisine & wines in Maxvorstadt. Book your table now!'}
        canonical="/romantisches-dinner-muenchen"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Romantisches Dinner' : 'Romantic Dinner', url: '/romantisches-dinner-muenchen' }
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
              {language === 'de' ? 'Romantisches Dinner München – Date Night im STORIA' : 'Romantic Dinner Munich – Date Night at STORIA'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Verbringen Sie einen unvergesslichen Abend zu zweit im STORIA. Italienische Romantik, exquisite Küche und erlesene Weine – der perfekte Rahmen für Ihre Date Night in München.'
                : 'Spend an unforgettable evening for two at STORIA. Italian romance, exquisite cuisine and fine wines – the perfect setting for your date night in Munich.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Ihr romantischer Abend' : 'Your Romantic Evening'}
              </h2>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ {language === 'de' ? 'Stilvolles italienisches Ambiente' : 'Stylish Italian ambiance'}</li>
                <li>✓ {language === 'de' ? 'Ausgewählte Weine aus Italien' : 'Selected wines from Italy'}</li>
                <li>✓ {language === 'de' ? 'Frische Pasta & Meeresfrüchte' : 'Fresh pasta & seafood'}</li>
                <li>✓ {language === 'de' ? 'Hausgemachte Dolci' : 'Homemade dolci'}</li>
                <li>✓ {language === 'de' ? 'Aufmerksamer, diskreter Service' : 'Attentive, discreet service'}</li>
              </ul>
            </div>

            <div className="bg-secondary/50 p-8 rounded-lg mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Perfekt für besondere Anlässe' : 'Perfect for Special Occasions'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Ob Jahrestag, Verlobung oder einfach ein besonderer Abend zu zweit – im STORIA schaffen wir den perfekten Rahmen für Ihre romantischen Momente. Zentral in der Maxvorstadt, nahe den Pinakotheken.'
                  : 'Whether anniversary, engagement or simply a special evening for two – at STORIA we create the perfect setting for your romantic moments. Central in Maxvorstadt, near the Pinakothek museums.'}
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <Button asChild>
                  <Link to="/reservierung">{language === 'de' ? 'Tisch reservieren' : 'Book a Table'}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/speisekarte">{language === 'de' ? 'Speisekarte ansehen' : 'View Menu'}</Link>
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

export default RomantischesDinner;
