import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ConsentOpenTable from "@/components/ConsentOpenTable";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Reservierung = () => {
  const { t, language } = useLanguage();
  const [iframeHeight, setIframeHeight] = useState(1100);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin.includes('opentable')) {
        if (event.data?.height && typeof event.data.height === 'number') {
          setIframeHeight(Math.max(event.data.height, 900));
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Tisch reservieren – Ristorante München' : 'Book a Table – Italian Restaurant Munich'}
        description={language === 'de' 
          ? 'Tisch reservieren im STORIA München Maxvorstadt: Italienisches Restaurant nahe Königsplatz & Pinakotheken. Jetzt einfach über OpenTable buchen!'
          : 'Book a table at STORIA Munich Maxvorstadt: Italian restaurant near Königsplatz & Pinakothek museums. Easy booking via OpenTable!'}
        canonical="/reservierung"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Reservierung' : 'Reservation', url: '/reservierung' }
        ]} 
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-8 text-center">
            <Link to="/">
              <img src={storiaLogo} alt="STORIA – Italienisches Restaurant München" className="h-24 md:h-32 mx-auto mb-4 hover:opacity-80 transition-opacity cursor-pointer" />
            </Link>
            <p className="text-lg text-muted-foreground tracking-wide font-sans">
              {t.hero.subtitle}
            </p>
          </div>
        </div>
        <Navigation />
        
        <main className="container mx-auto px-4 py-12 flex-grow">
          <h1 className="text-4xl font-bold mb-4 text-center">
            {language === 'de' ? 'Tisch reservieren – Ristorante München Maxvorstadt' : 'Book a Table – Italian Restaurant Munich Maxvorstadt'}
          </h1>
          <p className="text-muted-foreground mb-8 text-center max-w-2xl mx-auto">
            {t.reservation.description}
            <br />
            <a href="tel:+498951519696" className="text-primary hover:underline font-medium">+49 89 51519696</a>
          </p>
          
          <div className="max-w-4xl mx-auto bg-card rounded-lg border border-border shadow-lg overflow-hidden">
            <ConsentOpenTable 
              src="https://www.opentable.de/booking/restref/availability?rid=115809&restref=115809&lang=de-DE&color=1&r3uid=cfe&dark=false&partysize=2&ot_source=Restaurant%20website"
              className="transition-[height] duration-300"
              height={iframeHeight}
            />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Reservierung;
