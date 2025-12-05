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

const LunchMuenchen = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Lunch München Maxvorstadt – Italienischer Mittagstisch' : 'Lunch Munich Maxvorstadt – Italian Lunch'}
        description={language === 'de' 
          ? 'Lunch München Maxvorstadt im STORIA: Italienischer Mittagstisch Mo-Fr, frische Pasta & Pizza nahe Hauptbahnhof. Mittagsmenü ab 11:30 Uhr. Jetzt Tisch reservieren!'
          : 'Lunch Munich Maxvorstadt at STORIA: Italian lunch Mon-Fri, fresh pasta & pizza near main station. Lunch menu from 11:30 AM. Book your table now!'}
        canonical="/lunch-muenchen-maxvorstadt"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Lunch München' : 'Lunch Munich', url: '/lunch-muenchen-maxvorstadt' }
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
              {language === 'de' ? 'Lunch München Maxvorstadt – Italienischer Mittagstisch' : 'Lunch Munich Maxvorstadt – Italian Lunch'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Genießen Sie Ihre Mittagspause im STORIA – Ihrem Italiener in der Maxvorstadt. Frisch zubereitete italienische Küche, nur wenige Gehminuten vom Hauptbahnhof und Königsplatz entfernt.'
                : 'Enjoy your lunch break at STORIA – your Italian restaurant in Maxvorstadt. Freshly prepared Italian cuisine, just a few minutes walk from the main station and Königsplatz.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Unser Mittagsangebot' : 'Our Lunch Offer'}
              </h2>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ {language === 'de' ? 'Wechselndes Mittagsmenü Mo-Fr' : 'Changing lunch menu Mon-Fri'}</li>
                <li>✓ {language === 'de' ? 'Frische Pasta & Pizza aus dem Steinofen' : 'Fresh pasta & stone-oven pizza'}</li>
                <li>✓ {language === 'de' ? 'Attraktive Mittagspreise' : 'Attractive lunch prices'}</li>
                <li>✓ {language === 'de' ? 'Schneller Service für Ihre Mittagspause' : 'Quick service for your lunch break'}</li>
              </ul>
              <p className="text-sm text-muted-foreground/70 italic">
                {language === 'de' ? 'Mittagszeit: Mo-Fr 11:30 – 14:30 Uhr' : 'Lunch hours: Mon-Fri 11:30 AM – 2:30 PM'}
              </p>
            </div>

            <div className="bg-secondary/50 p-8 rounded-lg mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'Ideal für Ihre Mittagspause' : 'Perfect for Your Lunch Break'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Ob Sie in der Nähe der TU München arbeiten, vom Hauptbahnhof kommen oder Ihr Büro nahe dem Königsplatz haben – das STORIA ist Ihr perfekter Ort für einen italienischen Mittagstisch in der Maxvorstadt.'
                  : 'Whether you work near TU Munich, come from the main station, or have your office near Königsplatz – STORIA is your perfect spot for Italian lunch in Maxvorstadt.'}
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <Button asChild>
                  <Link to="/mittagsmenu">{language === 'de' ? 'Aktuelles Mittagsmenü' : 'Current Lunch Menu'}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/speisekarte">{language === 'de' ? 'Zur Speisekarte' : 'View Full Menu'}</Link>
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

export default LunchMuenchen;
