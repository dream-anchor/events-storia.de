import { useState } from "react";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingCart, Check, Truck, Utensils, Sparkles } from "lucide-react";

// Import images
import spiediniImg from "@/assets/catering/platten/spiedini.webp";
import bruschetteImg from "@/assets/catering/platten/bruschette.webp";
import focacceImg from "@/assets/catering/platten/focacce.webp";
import vitelloImg from "@/assets/catering/platten/vitello-tonnato.webp";
import entenbrustImg from "@/assets/catering/platten/entenbrust.webp";
import roastbeefImg from "@/assets/catering/platten/roastbeef.webp";
import kaeseplatteImg from "@/assets/catering/platten/kaeseplatte.webp";
import grillgemueseImg from "@/assets/catering/platten/grillgemuese.webp";
import lachsImg from "@/assets/catering/platten/lachs.webp";
import aufschnittImg from "@/assets/catering/platten/aufschnitt.webp";

interface Platter {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  serving_info: string;
  serving_info_en: string;
  image: string | null;
  objectPosition?: string;
}

const platters: Platter[] = [
  {
    id: "insalate-stagione",
    name: "Insalate di stagione",
    name_en: "Seasonal Salads",
    description: "4 verschiedene Salate der Saison:\n• Bunter Salat Primavera – Rote Bete Carpaccio, Mango, Mesclunsalat und Avocado mit Zitronenvinaigrette\n• Insalata Caprina – gegrillter Ziegenkäse, Babyspinat, Waldhonig, Kernmix, Honig-Senf-Dressing\n• Insalata al Salmone – gegrilltes Lachsfilet, Avocadocreme, Kernmix, Walnuss-Kräutercreme\n• Caesar Salat – Romanasalat, Croutons, Parmigiano, Caesar-Dressing",
    description_en: "4 different seasonal salads:\n• Colorful Primavera Salad – Beetroot carpaccio, mango, mesclun salad and avocado with lemon vinaigrette\n• Insalata Caprina – grilled goat cheese, baby spinach, forest honey, seed mix, honey-mustard dressing\n• Insalata al Salmone – grilled salmon fillet, avocado cream, seed mix, walnut-herb cream\n• Caesar Salad – romaine lettuce, croutons, Parmigiano, Caesar dressing",
    price: 45.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: null
  },
  {
    id: "spiedini-mozzarelline",
    name: "Spiedini di Mozzarelline – Platte",
    name_en: "Mini Mozzarella Skewers Platter",
    description: "Spieße aus mini-Büffelmozzarella, Kirschtomaten und frisches Basilikum – klassisch, leicht und voller Geschmack.",
    description_en: "Skewers of mini buffalo mozzarella, cherry tomatoes and fresh basil – classic, light and full of flavor.",
    price: 28.90,
    serving_info: "Platte aus 12 Spießen",
    serving_info_en: "Platter of 12 skewers",
    image: spiediniImg,
    objectPosition: "center center"
  },
  {
    id: "bruschette-platte",
    name: "Bruschette – Platte",
    name_en: "Bruschetta Platter",
    description: "Auswahl an 16 hausgemachten Bruschette:\n• Bruschette mit Tomaten\n• Bruschette mit Vitello Tonnato\n• Bruschette mit Kräuter-Mousse und Graved Lachs",
    description_en: "Selection of 16 homemade bruschetta:\n• Bruschetta with tomatoes\n• Bruschetta with Vitello Tonnato\n• Bruschetta with herb mousse and gravlax",
    price: 36.00,
    serving_info: "Auswahl an 16 Bruschette",
    serving_info_en: "Selection of 16 bruschetta",
    image: bruschetteImg,
    objectPosition: "center 70%"
  },
  {
    id: "focacce",
    name: "Focacce",
    name_en: "Focaccia",
    description: "4 verschiedene hausgemachte Focacce:\n• Caponata (sizilianisches Gemüsegericht mit Auberginen, Tomaten & Oliven)\n• Frischkäse, Parma, Rucola, Kirschtomaten und Parmesan\n• Caprese mit frischen Tomaten & Büffelmozzarella\n• Frischkäse, Graved Lachs, Rucola und Kirschtomaten",
    description_en: "4 different homemade focacce:\n• Caponata (Sicilian vegetable dish with eggplant, tomatoes & olives)\n• Cream cheese, Parma ham, arugula, cherry tomatoes and Parmesan\n• Caprese with fresh tomatoes & buffalo mozzarella\n• Cream cheese, gravlax, arugula and cherry tomatoes",
    price: 32.50,
    serving_info: "Ofenfrisches, gefülltes italienisches Brot",
    serving_info_en: "Oven-fresh, filled Italian bread",
    image: focacceImg,
    objectPosition: "center center"
  },
  {
    id: "verdure-griglia",
    name: 'Mediterrane Gemüse-Platte "Verdure alla Griglia"',
    name_en: 'Mediterranean Vegetable Platter "Verdure alla Griglia"',
    description: "Feine Auswahl an gegrilltem, mediterranem Gemüse – Zucchini, Paprika, Auberginen, Champignons mit Kräutern, Meersalz und nativem Olivenöl verfeinert. Leicht, aromatisch und perfekt als Beilage oder vegetarisches Hauptgericht.",
    description_en: "Fine selection of grilled Mediterranean vegetables – zucchini, peppers, eggplant, mushrooms refined with herbs, sea salt and extra virgin olive oil. Light, aromatic and perfect as a side dish or vegetarian main course.",
    price: 32.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: grillgemueseImg,
    objectPosition: "center 60%"
  },
  {
    id: "graved-lachs",
    name: "Graved Lachs-Platte",
    name_en: "Gravlax Salmon Platter",
    description: "Graved Lachs auf Rucola mit Kirschtomaten & Kräutervinaigrette.",
    description_en: "Gravlax salmon on arugula with cherry tomatoes & herb vinaigrette.",
    price: 44.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: lachsImg,
    objectPosition: "center 65%"
  },
  {
    id: "vitello-tonnato",
    name: "Vitello Tonnato-Platte",
    name_en: "Vitello Tonnato Platter",
    description: "Zartes Kalbfleisch mit hausgemachter Thunfisch-Kapern-Sauce.",
    description_en: "Tender veal with homemade tuna-caper sauce.",
    price: 41.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: vitelloImg,
    objectPosition: "center 70%"
  },
  {
    id: "entenbrust-carpaccio",
    name: "Entenbrust-Carpaccio mit Orangensauce",
    name_en: "Duck Breast Carpaccio with Orange Sauce",
    description: "Entenbrust-Carpaccio mit Orangecreme",
    description_en: "Duck breast carpaccio with orange cream",
    price: 48.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: entenbrustImg,
    objectPosition: "center center"
  },
  {
    id: "roastbeef",
    name: "Roastbeef mit Parmesanhobel",
    name_en: "Roast Beef with Parmesan Shavings",
    description: "Zart rosa gebratenes Roastbeef vom bayerischen Rind mit Parmesanhobel und grüner Kräutersauce.",
    description_en: "Tender pink roast beef from Bavarian cattle with Parmesan shavings and green herb sauce.",
    price: 44.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: roastbeefImg,
    objectPosition: "center 60%"
  },
  {
    id: "aufschnittplatte",
    name: "Italienische Aufschnittplatte",
    name_en: "Italian Charcuterie Platter",
    description: "Edle Auswahl an italienischen Aufschnittspezialitäten: Parmaschinken, Spianata Romana, Coppa und Südtiroler Speck",
    description_en: "Fine selection of Italian charcuterie specialties: Parma ham, Spianata Romana, Coppa and South Tyrolean bacon",
    price: 40.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: aufschnittImg,
    objectPosition: "center center"
  },
  {
    id: "kaeseplatte",
    name: "Gemischte Käseplatte",
    name_en: "Mixed Cheese Platter",
    description: "Auswahl italienischer Käsesorten mit Nüssen, Obst & Feigensenf.",
    description_en: "Selection of Italian cheeses with nuts, fruit & fig mustard.",
    price: 44.00,
    serving_info: "Ideal für 4 Personen",
    serving_info_en: "Ideal for 4 people",
    image: kaeseplatteImg,
    objectPosition: "center 55%"
  }
];

interface PlatterCardProps {
  platter: Platter;
  language: string;
}

const PlatterCard = ({ platter, language }: PlatterCardProps) => {
  const { addToCart, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  
  const name = language === 'en' ? platter.name_en : platter.name;
  const description = language === 'en' ? platter.description_en : platter.description;
  const servingInfo = language === 'en' ? platter.serving_info_en : platter.serving_info;
  
  const cartItem = items.find(i => i.id === platter.id);
  const isInCart = !!cartItem;

  const handleAddToCart = () => {
    addToCart({
      id: platter.id,
      name: platter.name,
      name_en: platter.name_en,
      price: platter.price,
      image: platter.image || undefined,
      serving_info: platter.serving_info,
    }, quantity);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group">
      {platter.image ? (
        <div className="aspect-square overflow-hidden relative">
          <img
            src={platter.image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ objectPosition: platter.objectPosition || "center center" }}
          />
          {isInCart && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Check className="h-3 w-3" />
              {cartItem.quantity}x
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-muted flex items-center justify-center relative">
          <span className="text-4xl">🥗</span>
          {isInCart && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Check className="h-3 w-3" />
              {cartItem.quantity}x
            </div>
          )}
        </div>
      )}
      <div className="p-4">
        <h3 className="font-serif font-medium text-lg mb-1">{name}</h3>
        <p className="text-xs text-primary/80 mb-2">{servingInfo}</p>
        <p className="text-sm text-muted-foreground mb-3 whitespace-pre-line line-clamp-4">{description}</p>
        
        <div className="flex justify-end mb-3">
          <span className="font-semibold text-primary text-lg">
            {platter.price.toFixed(2).replace(".", ",")} €
          </span>
        </div>

        {/* Add to Cart Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="px-2 py-1.5 hover:bg-muted transition-colors"
              aria-label="Menge reduzieren"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-3 py-1.5 text-sm font-medium min-w-[40px] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(q => q + 1)}
              className="px-2 py-1.5 hover:bg-muted transition-colors"
              aria-label="Menge erhöhen"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button 
            onClick={handleAddToCart}
            size="sm"
            className={`flex-1 transition-all ${isAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
          >
            {isAdded ? (
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

const BuffetPlatten = () => {
  const { language } = useLanguage();

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
            <div className="max-w-4xl mx-auto text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {language === 'de' ? 'Platten & Sharing-Gerichte' : 'Platters & Sharing Dishes'}
              </h1>
              <p className="text-lg text-muted-foreground">
                {language === 'de' 
                  ? 'Perfekt zum Teilen in geselliger Runde – servierfertig, stilvoll und frisch.'
                  : 'Perfect for sharing in good company – ready to serve, stylish and fresh.'}
              </p>
            </div>

            {/* Steinhofenbrot Info */}
            <div className="max-w-3xl mx-auto mb-12">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                <p className="text-sm text-primary font-medium">
                  🍞 {language === 'de' 
                    ? 'Zu jeder Platte servieren wir unser hausgemachtes Steinhofenbrot'
                    : 'With every platter we serve our homemade stone-oven bread'}
                </p>
              </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {platters.map((platter) => (
                <PlatterCard key={platter.id} platter={platter} language={language} />
              ))}
            </div>

            <p className="text-center text-muted-foreground mt-8 italic">
              {language === 'de' 
                ? 'Alle Platten können nach Ihren Wünschen angepasst werden.'
                : 'All platters can be customized to your preferences.'}
            </p>

            {/* Zusatzleistungen Box */}
            <div className="max-w-3xl mx-auto mt-16">
              <div className="bg-card border border-border rounded-lg p-6 md:p-8">
                <h2 className="text-xl font-serif font-medium mb-6 text-center">
                  {language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Truck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">
                        {language === 'de' ? 'Lieferung & Abholung' : 'Delivery & Pickup'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'de' ? 'Kostenlos im nahen Umkreis' : 'Free within nearby area'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Utensils className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">
                        {language === 'de' ? 'Aufbau & Service' : 'Setup & Service'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'de' ? 'Optional buchbar' : 'Optionally bookable'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">
                        {language === 'de' ? 'Reinigung' : 'Cleaning'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'de' ? 'Im Preis inklusive' : 'Included in price'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
