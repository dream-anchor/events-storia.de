import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const BuffetAuflauf = () => {
  const { language } = useLanguage();

  const dishes = language === 'de' ? [
    { name: "Lasagne Bolognese", desc: "Klassiker mit hausgemachter Ragù" },
    { name: "Lasagne Vegetariana", desc: "Mit gegrilltem Gemüse und Béchamel" },
    { name: "Melanzane alla Parmigiana", desc: "Auberginenauflauf mit Tomaten und Mozzarella" },
    { name: "Cannelloni Ricotta e Spinaci", desc: "Mit Ricotta und Spinat gefüllt" },
    { name: "Gnocchi al Forno", desc: "Überbackene Kartoffelnocken" },
    { name: "Polenta mit Ragù", desc: "Cremige Polenta mit Fleischsauce" },
  ] : [
    { name: "Lasagne Bolognese", desc: "Classic with homemade ragù" },
    { name: "Lasagne Vegetariana", desc: "With grilled vegetables and béchamel" },
    { name: "Melanzane alla Parmigiana", desc: "Eggplant bake with tomatoes and mozzarella" },
    { name: "Cannelloni Ricotta e Spinaci", desc: "Filled with ricotta and spinach" },
    { name: "Gnocchi al Forno", desc: "Oven-baked potato gnocchi" },
    { name: "Polenta with Ragù", desc: "Creamy polenta with meat sauce" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Warme Gerichte & Aufläufe | STORIA Catering München" : "Hot Dishes & Casseroles | STORIA Catering Munich"}
        description={language === 'de' ? "Wie hausgemacht – ofenfrisch geliefert für Büro, Zuhause oder Events. STORIA Catering München." : "Like homemade – delivered oven-fresh for office, home or events. STORIA Catering Munich."}
        canonical="/catering/buffet-auflauf"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Warme Gerichte & Aufläufe' : 'Hot Dishes & Casseroles'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Wie hausgemacht – ofenfrisch geliefert für Büro, Zuhause oder Events. Unsere Aufläufe und warmen Gerichte sind perfekt zum Teilen.'
                  : 'Like homemade – delivered oven-fresh for office, home or events. Our casseroles and hot dishes are perfect for sharing.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Ofenfrische Klassiker' : 'Oven-Fresh Classics'}
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
                  ? 'Alle Gerichte werden heiß geliefert und sind sofort servierbereit.'
                  : 'All dishes are delivered hot and ready to serve immediately.'}
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

export default BuffetAuflauf;
