import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Plus, Minus, ShoppingCart, Check, Flame, Wheat, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { HighlightCard, ServicesGrid } from "@/components/catering/ServiceInfoCard";

// No static image imports needed - using database URLs

const chafingDish = {
  id: "chafing-dish",
  name: "Chafing Dish",
  name_en: "Chafing Dish",
  description: "Warmhaltebehälter für Ihre Auflaufgerichte – hält das Essen servierbereit warm.",
  description_en: "Warming container for your casserole dishes – keeps food warm and ready to serve.",
  price: 25.00
};

interface MenuItemCardProps {
  item: CateringMenuItem;
  language: string;
}

const MenuItemCard = ({ item, language }: MenuItemCardProps) => {
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    if (!item.price) return;
    
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en || null,
      price: item.price,
      image: item.image_url || undefined,
      serving_info: (language === 'de' ? item.serving_info : item.serving_info_en) || undefined,
      category: 'buffet',
    }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const name = language === 'de' ? item.name : (item.name_en || item.name);
  const description = language === 'de' ? item.description : (item.description_en || item.description);
  const servingInfo = language === 'de' ? item.serving_info : (item.serving_info_en || item.serving_info);
  const image = item.image_url;
  const imagePosition = 'center center';
  
  const cartItem = items.find(i => i.id === item.id);
  const isInCart = !!cartItem;

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      {image && (
        <div className="aspect-square overflow-hidden relative">
          <img
            src={image}
            alt={`${name} – STORIA Catering München`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ objectPosition: imagePosition }}
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
      )}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif font-medium text-xl mb-1">{name}</h3>
        {servingInfo && <p className="text-sm text-primary/80 mb-2">{servingInfo}</p>}
        {description && <p className="text-base text-muted-foreground mb-3 line-clamp-4">{description}</p>}
        
        <div className="flex justify-between items-end mb-3">
          <div />
          {item.price && (
            <span className="font-semibold text-primary text-xl">
              {formatPrice(item.price)}
            </span>
          )}
        </div>

        {/* Add to Cart Controls */}
        {item.price && (
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center gap-2">
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
            {isInCart && !added && (
              <Button
                asChild
                variant="checkoutCta"
                size="sm"
                className="w-full"
              >
                <Link to="/checkout">
                  {language === 'de' ? 'Zur Kasse' : 'Checkout'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        )}
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
  const { data: menu, isLoading, error } = useCateringMenuBySlug("buffet-auflauf");

  const title = language === 'en' && menu?.title_en ? menu.title_en : menu?.title;
  const subtitle = language === 'en' && menu?.subtitle_en ? menu.subtitle_en : menu?.subtitle;

  // Flatten all items from all categories
  const allItems = menu?.categories.flatMap(cat => cat.items) || [];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Buffet & Warme Gerichte | STORIA Catering München" : "Buffet & Hot Dishes | STORIA Catering Munich"}
        description={language === 'de' ? "Warme italienische Gerichte für Ihr Event: Lasagne, Parmigiana, Ossobuco & mehr. Mit Chafing Dish Option. STORIA Catering München." : "Hot Italian dishes for your event: lasagna, parmigiana, ossobuco & more. Chafing dish available. STORIA Catering Munich."}
        canonical="/catering/buffet-auflauf"
      />
      {allItems.length > 0 && (
        <StructuredData
          type="product"
          breadcrumbs={[
            { name: 'Home', url: '/' },
            { name: 'Catering', url: '/events' },
            { name: language === 'de' ? 'Warme Gerichte' : 'Hot Dishes', url: '/catering/buffet-auflauf' },
          ]}
          products={allItems.map(item => ({
            name: item.name,
            name_en: item.name_en || undefined,
            description: item.description || '',
            description_en: item.description_en || undefined,
            price: item.price || 0,
            image: item.image_url || undefined,
            sku: item.id,
            servingInfo: item.serving_info || undefined,
          }))}
        />
      )}
      <Header />
      <Navigation />
      <div className="min-h-screen bg-background flex flex-col">
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
                {isLoading ? (
                  <Skeleton className="h-10 w-64 mx-auto" />
                ) : (
                  title || (language === 'de' ? 'Buffet / Warme Gerichte' : 'Buffet / Hot Dishes')
                )}
              </h1>
              {isLoading ? (
                <Skeleton className="h-20 w-full max-w-2xl mx-auto" />
              ) : (
                <p className="text-xl text-muted-foreground">
                  {subtitle || (language === 'de' 
                    ? 'Perfekt zum Teilen in geselliger Runde – servierfertig, frisch und ofenheiß.'
                    : 'Perfect for sharing in good company – ready to serve, fresh and oven-hot.')}
                </p>
              )}
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
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-square w-full" />
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} language={language} />
                  ))}
                </div>
              )}
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
