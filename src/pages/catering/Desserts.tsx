import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const Desserts = () => {
  const { language } = useLanguage();

  const desserts = language === 'de' ? [
    { name: "Tiramisù", desc: "Der italienische Klassiker" },
    { name: "Panna Cotta", desc: "Mit Beerensoße oder Karamell" },
    { name: "Cannoli Siciliani", desc: "Gefüllt mit Ricotta-Creme" },
    { name: "Torta della Nonna", desc: "Omas Kuchen mit Pinienkernen" },
    { name: "Semifreddo", desc: "Halbgefrorene Dessert-Variationen" },
    { name: "Dolci Misti", desc: "Gemischte Mini-Desserts" },
  ] : [
    { name: "Tiramisù", desc: "The Italian classic" },
    { name: "Panna Cotta", desc: "With berry sauce or caramel" },
    { name: "Cannoli Siciliani", desc: "Filled with ricotta cream" },
    { name: "Torta della Nonna", desc: "Grandma's cake with pine nuts" },
    { name: "Semifreddo", desc: "Semi-frozen dessert variations" },
    { name: "Dolci Misti", desc: "Mixed mini desserts" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Desserts & Dolci | STORIA Catering München" : "Desserts & Dolci | STORIA Catering Munich"}
        description={language === 'de' ? "Der perfekte Abschluss – ideal auch für Zuhause & kleine Feiern. STORIA Catering München." : "The perfect finish – also ideal for home & small celebrations. STORIA Catering Munich."}
        canonical="/catering/desserts"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Desserts & Dolci' : 'Desserts & Dolci'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Der perfekte Abschluss – ideal auch für Zuhause & kleine Feiern. Süße italienische Verführungen für jeden Geschmack.'
                  : 'The perfect finish – also ideal for home & small celebrations. Sweet Italian temptations for every taste.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Süße Versuchungen' : 'Sweet Temptations'}
              </h2>
              <div className="grid gap-4">
                {desserts.map((dessert, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{dessert.name}</h3>
                      <p className="text-sm text-muted-foreground">{dessert.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Desserts auch einzeln oder als gemischte Platte bestellbar.'
                  : 'Desserts also available individually or as a mixed platter.'}
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

export default Desserts;
