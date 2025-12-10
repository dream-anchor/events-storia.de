import { Plus, Minus } from "lucide-react";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";
import { ServicesGrid, AllergenInfo } from "@/components/catering/ServiceInfoCard";
import heroImage from "@/assets/catering/pizze/hero-pizza.webp";

interface Pizza {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  allergens?: string;
}

const pizzaPane: Pizza = {
  id: "pizza-pane",
  name: "Pizza Pane",
  name_en: "Pizza Bread",
  description: "Zur Auswahl: Pizza-Bällchen mit Rosmarin & Nativem Olivenöl Extra ODER Pizza Aglio e Olio mit Knoblauch, Oregano & Nativem Olivenöl Extra",
  description_en: "Choose: Pizza balls with rosemary & extra virgin olive oil OR Pizza Aglio e Olio with garlic, oregano & extra virgin olive oil",
  price: 7.90,
};

const pizzeClassiche: Pizza[] = [
  { id: "marinara", name: "Pizza Marinara", name_en: "Pizza Marinara", description: "Crovarese Tomaten, Knoblauch, Oregano, Natives Olivenöl Extra", description_en: "Crovarese tomatoes, garlic, oregano, extra virgin olive oil", price: 9.90 },
  { id: "cilentana", name: "Pizza Cilentana", name_en: "Pizza Cilentana", description: "Kirschtomaten, Ziegenkäse, Basilikum", description_en: "Cherry tomatoes, goat cheese, basil", price: 9.90 },
  { id: "margherita", name: "Pizza Margherita", name_en: "Pizza Margherita", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Basilikum", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, basil", price: 12.50, allergens: "a,g" },
  { id: "provola-pepe", name: "Pizza Provola e Pepe", name_en: "Pizza Provola e Pepe", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Provola, Kirschtomaten & Pfeffer", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, provola, cherry tomatoes & pepper", price: 13.90 },
  { id: "vegetale", name: "Pizza Vegetale", name_en: "Pizza Vegetale", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Saisongemüse", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, seasonal vegetables", price: 16.50 },
  { id: "salame-piccante", name: "Pizza Salame Piccante", name_en: "Pizza Spicy Salami", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Scharfe Salami", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, spicy salami", price: 15.90, allergens: "a,g,3" },
  { id: "regina", name: "Pizza Regina", name_en: "Pizza Regina", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Champignons, Hinterschinken", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, mushrooms, ham", price: 15.90, allergens: "a,g" },
  { id: "4-stagioni", name: "Pizza 4 Stagioni", name_en: "Pizza 4 Seasons", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Schinken, Pilze, Oliven, Kirschtomaten", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, ham, mushrooms, olives, cherry tomatoes", price: 16.90 },
  { id: "capricciosa", name: "Pizza Capricciosa", name_en: "Pizza Capricciosa", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Champignons, schwarze Oliven, Hinterschinken, Artischocken", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, mushrooms, black olives, ham, artichokes", price: 16.90, allergens: "a,g,3,6" },
  { id: "napoletana", name: "Pizza Napoletana", name_en: "Pizza Napoletana", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Sardellen, Olivenöl, Oregano", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, anchovies, olive oil, oregano", price: 16.90, allergens: "a,g" },
  { id: "calzone", name: "Pizza Calzone", name_en: "Pizza Calzone", description: "Gefüllte Pizza mit San Marzano Tomaten, Fior di Latte Mozzarella, Champignons, Schinken, scharfer Salami", description_en: "Folded pizza with San Marzano tomatoes, Fior di Latte mozzarella, mushrooms, ham, spicy salami", price: 16.90, allergens: "a,g,3" },
  { id: "4-formaggi", name: "Pizza Bianca 4 Formaggi", name_en: "White Pizza 4 Cheeses", description: "Fior di Latte Mozzarella, Caciocavallo, Pecorino, Gorgonzola, Parmesan", description_en: "Fior di Latte mozzarella, caciocavallo, pecorino, gorgonzola, parmesan", price: 16.90, allergens: "a,g,h" },
  { id: "carrettiera", name: "Pizza Bianca Carrettiera", name_en: "White Pizza Carrettiera", description: "Fior di Latte Mozzarella, Salsiccia & Rapsblüten", description_en: "Fior di Latte mozzarella, sausage & rapeseed flowers", price: 17.50 },
  { id: "bianca-prosciutto", name: "Pizza Bianca Prosciutto", name_en: "White Pizza Ham", description: "Fior di Latte Mozzarella, Hinterschinken", description_en: "Fior di Latte mozzarella, ham", price: 15.90, allergens: "a,g" },
  { id: "bufalina", name: "Pizza Bufalina", name_en: "Pizza Bufalina", description: "San Marzano Tomaten, Büffelmozzarella & Bocconcini D.O.P.", description_en: "San Marzano tomatoes, buffalo mozzarella & bocconcini D.O.P.", price: 16.50, allergens: "a,g" },
  { id: "caprese-bufala", name: "Pizza Caprese con Bufala", name_en: "Pizza Caprese with Buffalo", description: "San Marzano Tomaten, Tomatenscheiben, Basilikum, Büffelmozzarella", description_en: "San Marzano tomatoes, tomato slices, basil, buffalo mozzarella", price: 16.50 },
  { id: "tartufo", name: "Pizza Tartufo", name_en: "Pizza Truffle", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Trüffel", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, truffle", price: 24.90, allergens: "a,g" },
  { id: "parma-rucola", name: "Pizza Parma Rucola", name_en: "Pizza Parma Arugula", description: "San Marzano Tomaten, Fior di Latte Mozzarella, Rucola, Parmaschinken, Parmesan", description_en: "San Marzano tomatoes, Fior di Latte mozzarella, arugula, Parma ham, parmesan", price: 17.90, allergens: "a,g,3" },
  { id: "stracciatella-bresaola", name: "Pizza Stracciatella e Bresaola", name_en: "Pizza Stracciatella & Bresaola", description: "San Marzano Tomaten, Burrata-Stracciatella, Rucola, Bresaola", description_en: "San Marzano tomatoes, burrata stracciatella, arugula, bresaola", price: 18.90, allergens: "a,g" },
  { id: "mortadella-pistacchi", name: "Pizza Bianca Mortadella e Pistacchi", name_en: "White Pizza Mortadella & Pistachio", description: "Fior di Latte Mozzarella, Mortadella & Pistaziencreme", description_en: "Fior di Latte mozzarella, mortadella & pistachio cream", price: 19.90 },
  { id: "carbonara", name: "Pizza Bianca alla Carbonara", name_en: "White Pizza Carbonara", description: "Eigelb, Guanciale, Pecorino", description_en: "Egg yolk, guanciale, pecorino", price: 16.90 },
  { id: "salmone", name: "Pizza Bianca al Salmone", name_en: "White Pizza Salmon", description: "Fior di Latte Mozzarella, Rucola, Lachs", description_en: "Fior di Latte mozzarella, arugula, salmon", price: 18.90, allergens: "a,d,g" },
  { id: "rossa-mare", name: "Pizza Rossa Mare", name_en: "Red Pizza Seafood", description: "Crovarese Tomaten, Knoblauch, Oregano, Natives Olivenöl Extra, Oktopus, Gamberoni, Muscheln", description_en: "Crovarese tomatoes, garlic, oregano, extra virgin olive oil, octopus, prawns, mussels", price: 22.90, allergens: "a,b,d,n" },
  { id: "tonno-sashimi", name: "Pizza Rossa Tonno Sashimi", name_en: "Red Pizza Tuna Sashimi", description: "Crovarese Tomaten, Rucola, Sashimi-Thunfisch mariniert mit Sojasauce", description_en: "Crovarese tomatoes, arugula, sashimi tuna marinated with soy sauce", price: 19.90, allergens: "a,d,f" },
];

const allergenKey = {
  a: { de: "Gluten", en: "Gluten" },
  b: { de: "Krebstiere", en: "Crustaceans" },
  d: { de: "Fisch", en: "Fish" },
  f: { de: "Soja", en: "Soy" },
  g: { de: "Milch", en: "Milk" },
  h: { de: "Schalenfrüchte", en: "Nuts" },
  n: { de: "Weichtiere", en: "Molluscs" },
  "3": { de: "Konservierungsstoffe", en: "Preservatives" },
  "6": { de: "Geschwärzt", en: "Blackened" },
};

const PizzaListItem = ({ pizza, language }: { pizza: Pizza; language: string }) => {
  const { addToCart, updateQuantity, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  
  const cartItem = items.find(item => item.id === pizza.id);
  const currentQuantity = cartItem?.quantity || 0;
  const displayName = language === 'en' ? pizza.name_en : pizza.name;
  const displayDesc = language === 'en' ? pizza.description_en : pizza.description;

  const handleIncrease = () => {
    addToCart({
      id: pizza.id,
      name: pizza.name,
      name_en: pizza.name_en,
      price: pizza.price,
      category: 'pizza',
    }, 1);
  };

  const handleDecrease = () => {
    if (currentQuantity > 0) {
      updateQuantity(pizza.id, currentQuantity - 1);
    }
  };

  return (
    <div className="group py-4 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors -mx-4 px-4 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-serif text-lg font-medium text-foreground">
              {displayName}
            </h3>
            {pizza.allergens && (
              <span className="text-xs text-muted-foreground font-mono">
                [{pizza.allergens}]
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {displayDesc}
          </p>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="font-semibold text-foreground whitespace-nowrap">
            {formatPrice(pizza.price)}
          </span>
          
          <div className={cn(
            "flex items-center gap-1 rounded-full p-1 transition-colors",
            currentQuantity > 0 ? "bg-primary/10" : "bg-muted/50"
          )}>
            <button
              onClick={handleDecrease}
              disabled={currentQuantity === 0}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-background transition-colors disabled:opacity-30"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className={cn(
              "w-6 text-center text-sm font-medium",
              currentQuantity > 0 && "text-primary"
            )}>{currentQuantity}</span>
            <button
              onClick={handleIncrease}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-background transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
const PizzaPaneCard = ({ language }: { language: string }) => {
  const { addToCart, updateQuantity, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  
  const cartItem = items.find(item => item.id === pizzaPane.id);
  const currentQuantity = cartItem?.quantity || 0;
  const displayName = language === 'en' ? pizzaPane.name_en : pizzaPane.name;
  const displayDesc = language === 'en' ? pizzaPane.description_en : pizzaPane.description;

  const handleIncrease = () => {
    addToCart({
      id: pizzaPane.id,
      name: pizzaPane.name,
      name_en: pizzaPane.name_en,
      price: pizzaPane.price,
      category: 'pizza',
    }, 1);
  };

  const handleDecrease = () => {
    if (currentQuantity > 0) {
      updateQuantity(pizzaPane.id, currentQuantity - 1);
    }
  };

  return (
    <div className="bg-muted/30 border border-border/50 rounded-2xl p-6 mb-12">
      <h2 className="text-xl font-serif font-medium mb-4 text-center">
        {displayName}
      </h2>
      <p className="text-muted-foreground text-center mb-6 max-w-xl mx-auto">
        {displayDesc}
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <span className="text-xl font-semibold">
          {formatPrice(pizzaPane.price)}
        </span>
        
        <div className={cn(
          "flex items-center gap-2 rounded-full p-1 border transition-colors",
          currentQuantity > 0 ? "bg-primary/10 border-primary/30" : "bg-background border-border/50"
        )}>
          <button
            onClick={handleDecrease}
            disabled={currentQuantity === 0}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className={cn(
            "w-8 text-center font-medium",
            currentQuantity > 0 && "text-primary"
          )}>{currentQuantity}</span>
          <button
            onClick={handleIncrease}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
const PizzeNapoletane = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? "Pizze Napoletane | STORIA Catering München" : "Pizze Napoletane | STORIA Catering Munich"}
        description={language === 'de' 
          ? "Original neapolitanische Pizza aus dem Steinofen – 25 Sorten für Lieferung & Abholung in München. STORIA Catering – Jetzt bestellen!" 
          : "Authentic Neapolitan stone-oven pizza – 25 varieties for delivery & pickup in Munich. STORIA Catering – Order now!"}
        canonical="/catering/pizze-napoletane"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative h-[40vh] min-h-[300px] overflow-hidden">
            <img 
              src={heroImage} 
              alt="Neapolitan pizza from wood-fired oven" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 flex items-end justify-center pb-8">
              <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground text-center">
                Pizze Napoletane
              </h1>
            </div>
          </section>

          {/* Intro Text */}
          <section className="container mx-auto px-4 py-12">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xl text-muted-foreground font-light mb-4">
                {language === 'de' 
                  ? 'Flexibel, Authentisch und Genussvoll'
                  : 'Flexible, Authentic and Delicious'}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {language === 'de'
                  ? 'Genießen Sie die traditionelle italienische Küche mit unseren frisch zubereiteten Pizze Napoletane. Bei STORIA Events in München bieten wir Ihnen die Möglichkeit, diese köstlichen Pizzen ganz nach Ihren Vorstellungen zu gestalten. Ob für private Feierlichkeiten oder geschäftliche Events – unsere Pizzen sind flexibel anpassbar und garantieren ein unvergessliches Geschmackserlebnis.'
                  : 'Enjoy traditional Italian cuisine with our freshly prepared Neapolitan pizzas. At STORIA Events in Munich, we offer you the opportunity to customize these delicious pizzas according to your preferences. Whether for private celebrations or business events – our pizzas are flexibly adaptable and guarantee an unforgettable taste experience.'}
              </p>
            </div>
          </section>

          {/* Pizza Menu */}
          <section className="container mx-auto px-4 pb-16">
            <div className="max-w-3xl mx-auto">
              
              {/* Pizza Pane */}
              <PizzaPaneCard language={language} />
              
              {/* Pizze Classiche */}
              <div className="mb-8">
                <h2 className="text-2xl font-serif font-medium mb-6 text-center border-b border-border pb-4">
                  Pizze Classiche
                </h2>
                
                <div className="space-y-1">
                  {pizzeClassiche.map((pizza) => (
                    <PizzaListItem key={pizza.id} pizza={pizza} language={language} />
                  ))}
                </div>
              </div>

              {/* Allergen Key */}
              <AllergenInfo allergens={allergenKey} className="mt-12" />

              {/* Additional Services */}
              <ServicesGrid 
                title={language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
                className="mt-12"
              />
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
