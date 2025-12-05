import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";

const PizzeNapoletane = () => {
  const { language } = useLanguage();

  const pizzas = language === 'de' ? [
    { name: "Margherita", desc: "Tomaten, Mozzarella, Basilikum" },
    { name: "Marinara", desc: "Tomaten, Knoblauch, Oregano" },
    { name: "Prosciutto e Funghi", desc: "Schinken und Champignons" },
    { name: "Quattro Formaggi", desc: "Vier italienische Käsesorten" },
    { name: "Diavola", desc: "Scharfe Salami, Peperoni" },
    { name: "Vegetariana", desc: "Gegrilltes Gemüse" },
  ] : [
    { name: "Margherita", desc: "Tomatoes, mozzarella, basil" },
    { name: "Marinara", desc: "Tomatoes, garlic, oregano" },
    { name: "Prosciutto e Funghi", desc: "Ham and mushrooms" },
    { name: "Quattro Formaggi", desc: "Four Italian cheeses" },
    { name: "Diavola", desc: "Spicy salami, peppers" },
    { name: "Vegetariana", desc: "Grilled vegetables" },
  ];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Pizza Napoletana | STORIA Catering München" : "Pizza Napoletana | STORIA Catering Munich"}
        description={language === 'de' ? "Frisch aus dem Steinofen – heiß geliefert, überall genießbar. STORIA Catering München." : "Fresh from the stone oven – delivered hot, enjoyable anywhere. STORIA Catering Munich."}
        canonical="/catering/pizze-napoletane"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                Pizza Napoletana
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Frisch aus dem Steinofen – heiß geliefert, überall genießbar. Unsere neapolitanischen Pizzen werden nach traditioneller Art zubereitet.'
                  : 'Fresh from the stone oven – delivered hot, enjoyable anywhere. Our Neapolitan pizzas are prepared in the traditional way.'}
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-serif font-medium mb-6 text-center">
                {language === 'de' ? 'Unsere Pizzen' : 'Our Pizzas'}
              </h2>
              <div className="grid gap-4">
                {pizzas.map((pizza, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-border">
                    <div>
                      <h3 className="font-medium">{pizza.name}</h3>
                      <p className="text-sm text-muted-foreground">{pizza.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Pizza-Catering ab 10 Stück möglich. Weitere Beläge auf Anfrage.'
                  : 'Pizza catering available from 10 pieces. Additional toppings upon request.'}
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

export default PizzeNapoletane;
