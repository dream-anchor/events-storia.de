import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import ReservationCTA from "@/components/ReservationCTA";
import { useLanguage } from "@/contexts/LanguageContext";

const UeberUns = () => {
  const { t, language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? "Über uns – La Famiglia Speranza" : "About Us – La Famiglia Speranza"}
        description={language === 'de' 
          ? "STORIA – Ihr Italiener in der Maxvorstadt München. Ristorante Pizzeria mit neapolitanischer Pizza, hausgemachter Pasta und italienischem Trattoria-Flair. La Famiglia Speranza."
          : "STORIA – Your Italian restaurant in Maxvorstadt Munich. Ristorante Pizzeria with Neapolitan pizza, homemade pasta and Italian trattoria atmosphere. La Famiglia Speranza."
        }
        canonical="/ueber-uns"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        <main className="flex-1 py-16 md:py-24">
          <div className="container mx-auto px-6 md:px-8 max-w-4xl">
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground text-center mb-10 md:mb-14">
              {t.about.title}
            </h1>
            
            <div className="space-y-6 text-muted-foreground font-sans text-base leading-relaxed">
              <p>{t.about.p1}</p>
              <p>{t.about.p2}</p>
              <p>{t.about.p3}</p>
              <p>{t.about.p4}</p>
              <p>{t.about.p5}</p>
              <p>{t.about.p6}</p>
              <p>{t.about.p7}</p>
              <p>{t.about.p8}</p>
              
              {/* Unterschrift */}
              <div className="text-left">
                <p className="text-foreground/70 mb-2">
                  {language === 'de' ? 'Wir freuen uns auf Sie.' : 'We look forward to seeing you.'}
                </p>
                <span className="font-signature text-3xl md:text-4xl text-foreground/80 italic">
                  Domenico Speranza
                </span>
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

export default UeberUns;
