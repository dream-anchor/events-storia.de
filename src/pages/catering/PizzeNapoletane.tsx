import { Link } from "react-router-dom";
import { Plus, Minus, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useCateringMenuBySlug, CateringMenuItem } from "@/hooks/useCateringMenus";
import { useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ServicesGrid, AllergenInfo } from "@/components/catering/ServiceInfoCard";
import heroImage from "@/assets/catering/pizze/hero-pizza.webp";

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

interface PizzaListItemProps {
  item: CateringMenuItem;
  language: string;
}

const PizzaListItem = ({ item, language }: PizzaListItemProps) => {
  const { addToCart, updateQuantity, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  
  const cartItem = items.find(i => i.id === item.id);
  const currentQuantity = cartItem?.quantity || 0;
  const displayName = language === 'en' && item.name_en ? item.name_en : item.name;
  const displayDesc = language === 'en' && item.description_en ? item.description_en : item.description;

  const handleIncrease = () => {
    if (!item.price) return;
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en || null,
      price: item.price,
      category: 'pizza',
    }, 1);
  };

  const handleDecrease = () => {
    if (currentQuantity > 0) {
      updateQuantity(item.id, currentQuantity - 1);
    }
  };

  // Extract allergens from description or a dedicated field
  // For now we'll check if there's allergen info in the price_display field
  const allergens = item.price_display;

  return (
    <div className="group py-4 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors -mx-4 px-4 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="font-serif text-xl font-medium text-foreground">
              {displayName}
            </h3>
            {allergens && (
              <span className="text-xs text-muted-foreground font-mono">
                [{allergens}]
              </span>
            )}
          </div>
          {displayDesc && (
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              {displayDesc}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {item.price && (
            <span className="font-semibold text-foreground whitespace-nowrap">
              {formatPrice(item.price)}
            </span>
          )}

          {item.price && (
            <div className="flex items-center gap-2">
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
              {currentQuantity > 0 && (
                <Button
                  asChild
                  variant="checkoutCta"
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  <Link to="/checkout">
                    {language === 'de' ? 'Kasse' : 'Checkout'}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PizzaPaneCard = ({ item, language }: { item: CateringMenuItem; language: string }) => {
  const { addToCart, updateQuantity, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  
  const cartItem = items.find(i => i.id === item.id);
  const currentQuantity = cartItem?.quantity || 0;
  const displayName = language === 'en' && item.name_en ? item.name_en : item.name;
  const displayDesc = language === 'en' && item.description_en ? item.description_en : item.description;

  const handleIncrease = () => {
    if (!item.price) return;
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en || null,
      price: item.price,
      category: 'pizza',
    }, 1);
  };

  const handleDecrease = () => {
    if (currentQuantity > 0) {
      updateQuantity(item.id, currentQuantity - 1);
    }
  };

  return (
    <div className="bg-muted/30 border border-border/50 rounded-2xl p-6 mb-12">
      <h2 className="text-2xl font-serif font-medium mb-4 text-center">
        {displayName}
      </h2>
      {displayDesc && (
        <p className="text-lg text-muted-foreground text-center mb-6 max-w-xl mx-auto">
          {displayDesc}
        </p>
      )}
      
      {item.price && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <span className="text-2xl font-semibold">
            {formatPrice(item.price)}
          </span>

          <div className="flex items-center gap-3">
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
            {currentQuantity > 0 && (
              <Button
                asChild
                variant="checkoutCta"
                size="sm"
              >
                <Link to="/checkout">
                  {language === 'de' ? 'Zur Kasse' : 'Checkout'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PizzeNapoletane = () => {
  const { language } = useLanguage();
  const { data: menu, isLoading, error } = useCateringMenuBySlug("pizze-napoletane");

  // Separate Pizza Pane from other pizzas (first category is usually Pizza Pane)
  const categories = menu?.categories || [];
  const pizzaPaneCategory = categories.find(cat => cat.name.toLowerCase().includes('pane'));
  const pizzaPaneItem = pizzaPaneCategory?.items[0];
  
  // Get all other pizza items
  const otherCategories = categories.filter(cat => !cat.name.toLowerCase().includes('pane'));
  const allPizzas = otherCategories.flatMap(cat => cat.items);

  // For structured data
  const allItems = menu?.categories.flatMap(cat => cat.items) || [];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Pizze Napoletane | STORIA Catering München" : "Pizze Napoletane | STORIA Catering Munich"}
        description={language === 'de' 
          ? "Original neapolitanische Pizza aus dem Steinofen – 25 Sorten für Lieferung & Abholung in München. STORIA Catering – Jetzt bestellen!" 
          : "Authentic Neapolitan stone-oven pizza – 25 varieties for delivery & pickup in Munich. STORIA Catering – Order now!"}
        canonical="/catering/pizze-napoletane"
      />
      {allItems.length > 0 && (
        <StructuredData
          type="product"
          breadcrumbs={[
            { name: 'Home', url: '/' },
            { name: 'Catering', url: '/events' },
            { name: 'Pizze Napoletane', url: '/catering/pizze-napoletane' },
          ]}
          products={allItems.map(item => ({
            name: item.name,
            name_en: item.name_en || undefined,
            description: item.description || '',
            description_en: item.description_en || undefined,
            price: item.price || 0,
            sku: item.id,
          }))}
        />
      )}
      <Header />
      <Navigation />
      <div className="min-h-screen bg-background flex flex-col">
        
        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative h-[40vh] min-h-[300px] overflow-hidden">
            <img 
              src={heroImage} 
              alt={language === 'de' ? 'Neapolitanische Pizza aus dem Steinofen – STORIA München' : 'Neapolitan pizza from wood-fired oven – STORIA Munich'}
              className="absolute inset-0 w-full h-full object-cover"
              width="1920"
              height="768"
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
              <p className="text-2xl text-muted-foreground font-light mb-4">
                {language === 'de' 
                  ? 'Flexibel, Authentisch und Genussvoll'
                  : 'Flexible, Authentic and Delicious'}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {language === 'de'
                  ? 'Genießen Sie die traditionelle italienische Küche mit unseren frisch zubereiteten Pizze Napoletane. Bei STORIA Events in München bieten wir Ihnen die Möglichkeit, diese köstlichen Pizzen ganz nach Ihren Vorstellungen zu gestalten. Ob für private Feierlichkeiten oder geschäftliche Events – unsere Pizzen sind flexibel anpassbar und garantieren ein unvergessliches Geschmackserlebnis.'
                  : 'Enjoy traditional Italian cuisine with our freshly prepared Neapolitan pizzas. At STORIA Events in Munich, we offer you the opportunity to customize these delicious pizzas according to your preferences. Whether for private celebrations or business events – our pizzas are flexibly adaptable and guarantee an unforgettable taste experience.'}
              </p>
            </div>
          </section>

          {/* Pizza Menu */}
          <section className="container mx-auto px-4 pb-16">
            <div className="max-w-3xl mx-auto">
              
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-8 w-48 mx-auto" />
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12 text-muted-foreground">
                  {language === 'de' 
                    ? 'Menü konnte nicht geladen werden. Bitte versuchen Sie es später erneut.'
                    : 'Menu could not be loaded. Please try again later.'}
                </div>
              ) : allItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {language === 'de' 
                    ? 'Das Menü wird derzeit aktualisiert. Bitte schauen Sie später wieder vorbei.'
                    : 'The menu is currently being updated. Please check back later.'}
                </div>
              ) : (
                <>
                  {/* Pizza Pane */}
                  {pizzaPaneItem && (
                    <PizzaPaneCard item={pizzaPaneItem} language={language} />
                  )}
                  
                  {/* Pizze Classiche */}
                  {otherCategories.map((category) => (
                    <div key={category.id} className="mb-8">
                      <h2 className="text-3xl font-serif font-medium mb-6 text-center border-b border-border pb-4">
                        {language === 'en' && category.name_en ? category.name_en : category.name}
                      </h2>
                      
                      <div className="space-y-1">
                        {category.items.map((item) => (
                          <PizzaListItem key={item.id} item={item} language={language} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Allergen Key */}
                  <AllergenInfo allergens={allergenKey} className="mt-12" />

                  {/* Additional Services */}
                  <ServicesGrid 
                    title={language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
                    className="mt-12"
                  />
                </>
              )}
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
