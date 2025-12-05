import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const CateringZuhause = () => {
  const { language } = useLanguage();

  const occasions = language === 'de' ? [
    { name: "Geburtstagsfeier", desc: "Individuelle Menüs für Ihr Fest" },
    { name: "Familienessen", desc: "Großzügige Platten für die ganze Familie" },
    { name: "Dinner Party", desc: "Elegantes Menü für besondere Anlässe" },
    { name: "Grillparty Italiano", desc: "Italienische Spezialitäten für draußen" },
    { name: "Brunch Domenicale", desc: "Entspannter Sonntagsbrunch" },
    { name: "Romantisches Dinner", desc: "Für zwei – mit allem was dazugehört" },
  ] : [
    { name: "Birthday Party", desc: "Custom menus for your celebration" },
    { name: "Family Dinner", desc: "Generous platters for the whole family" },
    { name: "Dinner Party", desc: "Elegant menu for special occasions" },
    { name: "Italian BBQ Party", desc: "Italian specialties for outdoor gatherings" },
    { name: "Sunday Brunch", desc: "Relaxed Sunday brunch" },
    { name: "Romantic Dinner", desc: "For two – with everything included" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Catering für Zuhause | STORIA Catering München" : "Catering for Home | STORIA Catering Munich"}
        description={language === 'de' ? "Für private Feiern, Geburtstage oder ein entspanntes Essen daheim. STORIA Catering München." : "For private parties, birthdays or a relaxed meal at home. STORIA Catering Munich."}
        canonical="/catering/catering-zuhause"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Catering für Zuhause' : 'Catering for Home'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Für private Feiern, Geburtstage oder ein entspanntes Essen daheim. Genießen Sie italienische Küche ohne selbst zu kochen.'
                  : 'For private parties, birthdays or a relaxed meal at home. Enjoy Italian cuisine without cooking yourself.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Für jeden Anlass' : 'For Every Occasion'}
              </h2>
              <div className="grid gap-4">
                {occasions.map((occasion, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{occasion.name}</h3>
                      <p className="text-sm text-muted-foreground">{occasion.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Wir liefern bis vor Ihre Haustür – auf Wunsch auch mit Geschirr und Service.'
                  : 'We deliver to your doorstep – also with tableware and service on request.'}
              </p>
            </div>
          </section>
          
          <CateringCTA />
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default CateringZuhause;
