import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const BuffetPlatten = () => {
  const { language } = useLanguage();

  const platters = language === 'de' ? [
    { name: "Antipasti Platte Grande", desc: "Auswahl italienischer Vorspeisen für 8-10 Personen" },
    { name: "Salumi e Formaggi", desc: "Italienische Wurst- und Käsespezialitäten" },
    { name: "Insalata Mista Platte", desc: "Frische Salatkreationen" },
    { name: "Pasta Sharing Bowl", desc: "Großer Pastateller zum Teilen" },
    { name: "Meeresfrüchte Platte", desc: "Frische Fisch- und Meeresfrüchtevariationen" },
    { name: "Gemüse Antipasti", desc: "Gegrilltes Gemüse nach mediterraner Art" },
  ] : [
    { name: "Antipasti Platter Grande", desc: "Selection of Italian appetizers for 8-10 people" },
    { name: "Salumi e Formaggi", desc: "Italian cured meats and cheese specialties" },
    { name: "Mixed Salad Platter", desc: "Fresh salad creations" },
    { name: "Pasta Sharing Bowl", desc: "Large pasta dish for sharing" },
    { name: "Seafood Platter", desc: "Fresh fish and seafood variations" },
    { name: "Vegetable Antipasti", desc: "Grilled vegetables Mediterranean style" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Platten & Sharing | STORIA Catering München" : "Platters & Sharing | STORIA Catering Munich"}
        description={language === 'de' ? "Ideal für Teams, Familien & private Dinner – servierfertig geliefert. STORIA Catering München." : "Ideal for teams, families & private dinners – delivered ready to serve. STORIA Catering Munich."}
        canonical="/catering/buffet-platten"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Platten & Sharing' : 'Platters & Sharing'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Ideal für Teams, Familien & private Dinner – servierfertig geliefert. Unsere großzügigen Platten bringen italienische Geselligkeit auf jeden Tisch.'
                  : 'Ideal for teams, families & private dinners – delivered ready to serve. Our generous platters bring Italian conviviality to every table.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Unsere Platten' : 'Our Platters'}
              </h2>
              <div className="grid gap-4">
                {platters.map((platter, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{platter.name}</h3>
                      <p className="text-sm text-muted-foreground">{platter.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Alle Platten können nach Ihren Wünschen angepasst werden.'
                  : 'All platters can be customized to your preferences.'}
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

export default BuffetPlatten;
