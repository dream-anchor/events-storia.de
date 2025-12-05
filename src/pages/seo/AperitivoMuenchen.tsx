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

const AperitivoMuenchen = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Aperitivo München – Italienische Bar Maxvorstadt' : 'Aperitivo Munich – Italian Bar Maxvorstadt'}
        description={language === 'de' 
          ? 'Aperitivo München im STORIA: Aperol Spritz, Negroni & italienische Cocktails in der Maxvorstadt. Late Night Aperitivo 21-22:30 Uhr. Jetzt Tisch reservieren!'
          : 'Aperitivo Munich at STORIA: Aperol Spritz, Negroni & Italian cocktails in Maxvorstadt. Late Night Aperitivo 9-10:30 PM. Book your table now!'}
        canonical="/aperitivo-muenchen"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Aperitivo München' : 'Aperitivo Munich', url: '/aperitivo-muenchen' }
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
              {language === 'de' ? 'Aperitivo München – Italienische Bar in der Maxvorstadt' : 'Aperitivo Munich – Italian Bar in Maxvorstadt'}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
              {language === 'de'
                ? 'Erleben Sie authentischen italienischen Aperitivo im STORIA. Klassische Cocktails, erlesene Weine und das gewisse italienische Flair – mitten in München.'
                : 'Experience authentic Italian aperitivo at STORIA. Classic cocktails, fine wines and that special Italian flair – in the heart of Munich.'}
            </p>

            <div className="bg-card p-8 rounded-lg border border-border mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'STORIA Notturno – Late Night Aperitivo' : 'STORIA Notturno – Late Night Aperitivo'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Täglich von 21:00 bis 22:30 Uhr laden wir Sie ein zum STORIA Notturno – unserem Late Night Aperitivo im italienischen Stil.'
                  : 'Daily from 9:00 PM to 10:30 PM, we invite you to STORIA Notturno – our Late Night Aperitivo Italian style.'}
              </p>
              <ul className="space-y-3 text-muted-foreground mb-6">
                <li>✓ Aperol Spritz & Negroni</li>
                <li>✓ {language === 'de' ? 'Italienische Weine' : 'Italian wines'}</li>
                <li>✓ {language === 'de' ? 'Klassische Cocktails' : 'Classic cocktails'}</li>
                <li>✓ {language === 'de' ? 'Stuzzichini & kleine Antipasti' : 'Stuzzichini & small antipasti'}</li>
              </ul>
            </div>

            <div className="bg-secondary/50 p-8 rounded-lg mb-8">
              <h2 className="text-2xl font-serif font-semibold mb-4">
                {language === 'de' ? 'La Dolce Vita in München' : 'La Dolce Vita in Munich'}
              </h2>
              <p className="text-muted-foreground mb-4">
                {language === 'de'
                  ? 'Ob nach der Arbeit, vor dem Dinner oder als Ausklang eines schönen Abends – unser Aperitivo bringt italienische Lebensfreude in die Maxvorstadt. Nur wenige Schritte vom Königsplatz und den Pinakotheken entfernt.'
                  : 'Whether after work, before dinner or as the end of a wonderful evening – our aperitivo brings Italian joie de vivre to Maxvorstadt. Just steps from Königsplatz and the Pinakothek museums.'}
              </p>
              <div className="flex flex-wrap gap-4 mt-6">
                <Button asChild>
                  <Link to="/getraenke">{language === 'de' ? 'Getränkekarte ansehen' : 'View Drinks Menu'}</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/reservierung">{language === 'de' ? 'Tisch reservieren' : 'Book a Table'}</Link>
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

export default AperitivoMuenchen;
