import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const Antipasti = () => {
  const { language } = useLanguage();

  const antipasti = language === 'de' ? [
    { name: "Carpaccio di Manzo", desc: "Hauchdünn geschnittenes Rindfleisch" },
    { name: "Vitello Tonnato", desc: "Kalbfleisch mit Thunfischsauce" },
    { name: "Burrata", desc: "Cremiger Mozzarella mit Tomaten" },
    { name: "Prosciutto e Melone", desc: "Parmaschinken mit Melone" },
    { name: "Caponata", desc: "Sizilianisches Auberginengericht" },
    { name: "Insalata di Mare", desc: "Meeresfrüchtesalat" },
  ] : [
    { name: "Carpaccio di Manzo", desc: "Thinly sliced beef" },
    { name: "Vitello Tonnato", desc: "Veal with tuna sauce" },
    { name: "Burrata", desc: "Creamy mozzarella with tomatoes" },
    { name: "Prosciutto e Melone", desc: "Parma ham with melon" },
    { name: "Caponata", desc: "Sicilian eggplant dish" },
    { name: "Insalata di Mare", desc: "Seafood salad" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Antipasti & Klassiker | STORIA Catering München" : "Antipasti & Classics | STORIA Catering Munich"}
        description={language === 'de' ? "Mediterrane Vorspeisen für Zuhause, Office-Lunch oder Aperitivo. STORIA Catering München." : "Mediterranean starters for home, office lunch or aperitivo. STORIA Catering Munich."}
        canonical="/catering/antipasti"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Antipasti & Klassiker' : 'Antipasti & Classics'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Mediterrane Vorspeisen für Zuhause, Office-Lunch oder Aperitivo. Authentische italienische Klassiker, die jeden Anlass bereichern.'
                  : 'Mediterranean starters for home, office lunch or aperitivo. Authentic Italian classics that enhance every occasion.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Klassische Antipasti' : 'Classic Antipasti'}
              </h2>
              <div className="grid gap-4">
                {antipasti.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Kombinieren Sie verschiedene Antipasti zu Ihrem perfekten Menü.'
                  : 'Combine different antipasti for your perfect menu.'}
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

export default Antipasti;
