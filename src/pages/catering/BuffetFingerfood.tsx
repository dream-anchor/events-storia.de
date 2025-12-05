import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const BuffetFingerfood = () => {
  const { language } = useLanguage();

  const dishes = language === 'de' ? [
    { name: "Bruschetta Trio", desc: "Tomate, Sardellen, Trüffel" },
    { name: "Mini Arancini", desc: "Sizilianische Reisbällchen" },
    { name: "Caprese Spieße", desc: "Mozzarella, Tomate, Basilikum" },
    { name: "Prosciutto Crostini", desc: "Mit Feigen und Rucola" },
    { name: "Mini Focaccia", desc: "Rosmarin und Meersalz" },
    { name: "Gegrillte Zucchini Röllchen", desc: "Mit Ricotta gefüllt" },
  ] : [
    { name: "Bruschetta Trio", desc: "Tomato, anchovies, truffle" },
    { name: "Mini Arancini", desc: "Sicilian rice balls" },
    { name: "Caprese Skewers", desc: "Mozzarella, tomato, basil" },
    { name: "Prosciutto Crostini", desc: "With figs and arugula" },
    { name: "Mini Focaccia", desc: "Rosemary and sea salt" },
    { name: "Grilled Zucchini Rolls", desc: "Filled with ricotta" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Fingerfood & Mini-Gerichte | STORIA Catering München" : "Finger Food & Mini Dishes | STORIA Catering Munich"}
        description={language === 'de' ? "Elegante italienische Häppchen für Empfänge, Meetings & gesellige Runden. STORIA Catering München." : "Elegant Italian bites for receptions, meetings & social gatherings. STORIA Catering Munich."}
        canonical="/catering/buffet-fingerfood"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Fingerfood & Mini-Gerichte' : 'Finger Food & Mini Dishes'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Elegante Häppchen für Empfänge, Meetings & gesellige Runden. Unsere Fingerfood-Auswahl ist perfekt für jeden Anlass – von Business-Events bis hin zu privaten Feiern.'
                  : 'Elegant bites for receptions, meetings & social gatherings. Our finger food selection is perfect for any occasion – from business events to private celebrations.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Beliebte Auswahl' : 'Popular Selection'}
              </h2>
              <div className="grid gap-4">
                {dishes.map((dish, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{dish.name}</h3>
                      <p className="text-sm text-muted-foreground">{dish.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Individuelle Zusammenstellung auf Anfrage möglich.'
                  : 'Custom selection available upon request.'}
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

export default BuffetFingerfood;
