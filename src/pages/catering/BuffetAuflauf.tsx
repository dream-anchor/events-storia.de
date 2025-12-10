import { useState } from "react";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingCart, Check, Flame, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { HighlightCard, ServicesGrid } from "@/components/catering/ServiceInfoCard";

// Images
import parmigianaImg from "@/assets/catering/auflauf/parmigiana.webp";
import lasagnaImg from "@/assets/catering/auflauf/lasagna.webp";
import kabeljauImg from "@/assets/catering/auflauf/kabeljau.webp";
import polloImg from "@/assets/catering/auflauf/pollo-cacciatora.webp";
import spezzatinoImg from "@/assets/catering/auflauf/spezzatino.webp";
import arrostoImg from "@/assets/catering/auflauf/arrosto-vitello.webp";

interface Dish {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  serving_info: string;
  serving_info_en: string;
  image: string;
  objectPosition?: string;
}

const dishes: Dish[] = [
  {
    id: "parmigiana-melanzane",
    name: "Parmigiana di Melanzane",
    name_en: "Eggplant Parmesan",
    description: "Hausgemachte Parmigiana di Melanzane – Auberginenauflauf mit Tomatensugo, Mozzarella und Parmigiano, im Ofen gebacken.",
    description_en: "Homemade Parmigiana di Melanzane – eggplant bake with tomato sugo, mozzarella and parmigiano, oven-baked.",
    price: 45.00,
    serving_info: "Ideal für 6 Personen",
    serving_info_en: "Ideal for 6 people",
    image: parmigianaImg,
    objectPosition: "center 60%"
  },
  {
    id: "lasagna-bolognese",
    name: "Lasagna alla Bolognese",
    name_en: "Lasagna Bolognese",
    description: "Hausgemachte Lasagne mit Ragù a la Bolognese, Mozzarella, Béchamel und Parmesan, im Ofen gebacken.",
    description_en: "Homemade lasagna with Bolognese ragù, mozzarella, béchamel and parmesan, oven-baked.",
    price: 55.00,
    serving_info: "Ideal für 6 Personen",
    serving_info_en: "Ideal for 6 people",
    image: lasagnaImg,
    objectPosition: "center center"
  },
  {
    id: "kabeljau-livornese",
    name: "Kabeljaufilet a la Livornese",
    name_en: "Cod Fillet Livornese Style",
    description: "Zartes Kabeljaufilet in Tomatensauce-Oliven-Knoblauch, mit Kartoffeln und Muscheln.",
    description_en: "Tender cod fillet in tomato-olive-garlic sauce with potatoes and mussels.",
    price: 60.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: kabeljauImg,
    objectPosition: "center center"
  },
  {
    id: "pollo-cacciatora",
    name: "Pollo alla Cacciatora",
    name_en: "Hunter's Style Chicken",
    description: "Zart geschmortes Hähnchenbrust in Kirschtomaten-Kräuter-Weißweinsauce mit schwarzen Oliven.",
    description_en: "Tender braised chicken breast in cherry tomato herb white wine sauce with black olives.",
    price: 45.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: polloImg,
    objectPosition: "center 60%"
  },
  {
    id: "spezzatino-vitello",
    name: "Spezzatino di Vitello",
    name_en: "Veal Stew",
    description: "Zartes Kalbsragout mit mediterranem Gemüse und Weißwein-Sauce – rustikal und elegant zugleich.",
    description_en: "Tender veal stew with Mediterranean vegetables and white wine sauce – rustic yet elegant.",
    price: 60.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: spezzatinoImg,
    objectPosition: "center center"
  },
  {
    id: "arrosto-vitello",
    name: "Arrosto di Vitello con patate",
    name_en: "Roast Veal with Potatoes",
    description: "Zarter Kalbsbraten im eigenen Jus mit Kartoffeln.",
    description_en: "Tender roast veal in its own jus with potatoes.",
    price: 72.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: arrostoImg,
    objectPosition: "center 55%"
  }
];

const chafingDish = {
  id: "chafing-dish",
  name: "Chafing Dish",
  name_en: "Chafing Dish",
  description: "Warmhaltebehälter für Ihre Auflaufgerichte – hält das Essen servierbereit warm.",
  description_en: "Warming container for your casserole dishes – keeps food warm and ready to serve.",
  price: 25.00
};

interface DishCardProps {
  dish: Dish;
  language: string;
}

const DishCard = ({ dish, language }: DishCardProps) => {
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart({
      id: dish.id,
      name: dish.name,
      name_en: dish.name_en,
      price: dish.price,
      image: dish.image,
      serving_info: language === 'de' ? dish.serving_info : dish.serving_info_en,
      category: 'buffet',
    }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const name = language === 'de' ? dish.name : dish.name_en;
  const description = language === 'de' ? dish.description : dish.description_en;
  const servingInfo = language === 'de' ? dish.serving_info : dish.serving_info_en;
  
  const cartItem = items.find(i => i.id === dish.id);
  const isInCart = !!cartItem;

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      <div className="aspect-square overflow-hidden relative">
        <img
          src={dish.image}
          alt={`${name} – STORIA Catering München`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          style={{ objectPosition: dish.objectPosition || 'center center' }}
          width="400"
          height="400"
          loading="lazy"
        />
        {isInCart && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Check className="h-3 w-3" />
            {cartItem.quantity}x
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif font-medium text-lg mb-1">{name}</h3>
        <p className="text-xs text-primary/80 mb-2">{servingInfo}</p>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-4">{description}</p>
        
        <div className="flex justify-between items-end mb-3">
          <div />
          <span className="font-semibold text-primary text-lg">
            {formatPrice(dish.price)}
          </span>
        </div>

        {/* Add to Cart Controls */}
        <div className="flex items-center gap-2 mt-auto">
          <div className="flex items-center border border-border rounded-md">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-2 py-1.5 hover:bg-muted transition-colors"
              aria-label="Menge reduzieren"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-3 py-1.5 text-sm font-medium min-w-[40px] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-2 py-1.5 hover:bg-muted transition-colors"
              aria-label="Menge erhöhen"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button
            onClick={handleAddToCart}
            size="sm"
            className={`flex-1 transition-all ${added ? 'bg-green-600 hover:bg-green-600' : ''}`}
          >
            {added ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                {language === 'de' ? 'Hinzugefügt' : 'Added'}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-1" />
                {language === 'de' ? 'In den Warenkorb' : 'Add to Cart'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ChafingDishOption = ({ language }: { language: string }) => {
  const { addToCart } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart({
      id: chafingDish.id,
      name: chafingDish.name,
      name_en: chafingDish.name_en,
      price: chafingDish.price,
      category: 'equipment',
    }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-6 mb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
            <Flame className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-serif font-medium flex items-center gap-2">
              {language === 'de' ? 'Optional: Chafing Dish' : 'Optional: Chafing Dish'}
              <span className="text-primary font-bold">+{formatPrice(chafingDish.price)}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'de' ? chafingDish.description : chafingDish.description_en}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto md:ml-0">
          <div className="flex items-center border rounded-md bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center font-medium">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={handleAddToCart}
            variant={added ? "default" : "outline"}
            className={cn(
              "transition-all duration-300 min-w-[140px]",
              added && "bg-green-600 hover:bg-green-600"
            )}
          >
            {added ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {language === 'de' ? 'Hinzugefügt' : 'Added'}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {language === 'de' ? 'Hinzufügen' : 'Add'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const BuffetAuflauf = () => {
  const { language } = useLanguage();

  return (
    <>
      <SEO 
        title={language === 'de' ? "Buffet & Warme Gerichte | STORIA Catering München" : "Buffet & Hot Dishes | STORIA Catering Munich"}
        description={language === 'de' ? "Warme italienische Gerichte für Ihr Event: Lasagne, Parmigiana, Ossobuco & mehr. Mit Chafing Dish Option. STORIA Catering München." : "Hot Italian dishes for your event: lasagna, parmigiana, ossobuco & more. Chafing dish available. STORIA Catering Munich."}
        canonical="/catering/buffet-auflauf"
      />
      <StructuredData 
        type="product" 
        products={dishes.map(d => ({
          name: d.name,
          name_en: d.name_en,
          description: d.description,
          description_en: d.description_en,
          price: d.price,
          image: d.image,
          sku: d.id,
          servingInfo: d.serving_info,
        }))} 
      />
      <Header />
      <Navigation />
      <div className="min-h-screen bg-background flex flex-col">
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Buffet / Warme Gerichte' : 'Buffet / Hot Dishes'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Perfekt zum Teilen in geselliger Runde – servierfertig, frisch und ofenheiß.'
                  : 'Perfect for sharing in good company – ready to serve, fresh and oven-hot.'}
              </p>
            </div>

            {/* Bread info */}
            <HighlightCard
              icon={Wheat}
              title="Hausgemachtes Steinhofenbrot"
              title_en="Homemade Stone Oven Bread"
              description="Zu jeder Ofenterrine servieren wir unser frisch gebackenes Brot aus dem Steinofen."
              description_en="We serve our freshly baked stone oven bread with every casserole."
              className="max-w-3xl mx-auto"
            />

            {/* Chafing Dish Option */}
            <div className="max-w-5xl mx-auto">
              <ChafingDishOption language={language} />
            </div>

            {/* Dishes Grid */}
            <div className="max-w-5xl mx-auto">
              <h2 className="sr-only">
                {language === 'de' ? 'Unsere Gerichte' : 'Our Dishes'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dishes.map((dish) => (
                  <DishCard key={dish.id} dish={dish} language={language} />
                ))}
              </div>
            </div>

            {/* Additional Services */}
            <ServicesGrid 
              title={language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
              className="mt-16"
            />
          </section>
          
          <CateringCTA />
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default BuffetAuflauf;
