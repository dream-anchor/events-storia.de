import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ConsentGoogleMaps from "@/components/ConsentGoogleMaps";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import ReservationCTA from "@/components/ReservationCTA";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import storiaLogo from "@/assets/storia-logo.webp";
import { useLanguage } from "@/contexts/LanguageContext";

const Kontakt = () => {
  const { t, language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Kontakt & Anfahrt – Pizza Maxvorstadt' : 'Contact & Directions – Italian Restaurant Munich'}
        description={language === 'de' 
          ? 'STORIA München Kontakt: Karlstraße 47a, Maxvorstadt. Nähe Hauptbahnhof, Königsplatz & TU München. Öffnungszeiten Mo-Fr 9-1 Uhr. Jetzt anrufen: +49 89 51519696!'
          : 'STORIA Munich contact: Karlstraße 47a, Maxvorstadt. Near main station, Königsplatz & TU Munich. Open Mon-Fri 9am-1am. Call now: +49 89 51519696!'}
        canonical="/kontakt"
      />
      <StructuredData 
        type="breadcrumb" 
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: language === 'de' ? 'Kontakt' : 'Contact', url: '/kontakt' }
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
            {language === 'de' ? 'Kontakt & Anfahrt – Italiener nahe Königsplatz München' : 'Contact & Directions – Italian Restaurant near Königsplatz Munich'}
          </h1>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            {language === 'de'
              ? 'Besuchen Sie uns in der Karlstraße 47a – zentral in der Maxvorstadt, nur wenige Gehminuten vom Hauptbahnhof, Königsplatz und der TU München entfernt.'
              : 'Visit us at Karlstraße 47a – centrally located in Maxvorstadt, just a few minutes walk from the main station, Königsplatz and TU Munich.'}
          </p>
          
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card p-8 rounded-lg border border-border">
              <h2 className="text-2xl font-serif font-bold mb-6">{t.contact.contactUs}</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-medium">{t.contact.phone}</p>
                    <a href="tel:+498951519696" className="text-muted-foreground hover:text-primary">
                      +49 89 51519696
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-medium">{t.contact.email}</p>
                    <a href="mailto:info@ristorantestoria.de" className="text-muted-foreground hover:text-primary">
                      info@ristorantestoria.de
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-medium">{t.contact.address}</p>
                    <p className="text-muted-foreground">
                      Karlstr. 47a<br />
                      80333 München
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1 italic">
                      {language === 'de' ? 'Nähe Königsplatz & Hauptbahnhof' : 'Near Königsplatz & main station'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card p-8 rounded-lg border border-border">
              <h2 className="text-2xl font-serif font-bold mb-6">{t.contact.openingHours}</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-1" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{t.contact.monFri}</span>
                      <span className="text-muted-foreground">09:00 - 01:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">{t.contact.satSun}</span>
                      <span className="text-muted-foreground">12:00 - 01:00</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-2">{t.contact.breakfast}</h3>
                <p className="text-sm text-muted-foreground">{t.contact.breakfastHours}</p>
              </div>

              <div className="mt-4 p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-2">{t.contact.notturno}</h3>
                <p className="text-sm text-muted-foreground">{t.contact.notturnoDesc}</p>
                <p className="text-sm text-muted-foreground">{t.contact.notturnoHours}</p>
              </div>
            </div>
          </div>

          {/* Google Maps */}
          <div id="map" className="max-w-4xl mx-auto mt-8">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <ConsentGoogleMaps
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2662.063!2d11.5628!3d48.1447!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x479e75f0a0c3c6e7%3A0x8c0b2b0b0b0b0b0b!2sKarlstra%C3%9Fe%2047a%2C%2080333%20M%C3%BCnchen!5e0!3m2!1sde!2sde!4v1700000000000!5m2!1sde!2sde"
                height={400}
                title="STORIA Ristorante Standort"
                className="w-full"
              />
            </div>
          </div>

          <ReservationCTA />
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Kontakt;
