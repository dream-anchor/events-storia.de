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
import { Plus, Minus, ShoppingCart, Check, Wheat, ArrowRight } from "lucide-react";
import { HighlightCard, ServicesGrid } from "@/components/catering/ServiceInfoCard";

// No static image imports needed - using database URLs

interface MenuItemCardProps {
  item: CateringMenuItem;
  language: string;
}

const MenuItemCard = ({ item, language }: MenuItemCardProps) => {
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  
  const name = language === 'en' && item.name_en ? item.name_en : item.name;
  const description = language === 'en' && item.description_en ? item.description_en : item.description;
  const servingInfo = language === 'en' && item.serving_info_en ? item.serving_info_en : item.serving_info;
  const image = item.image_url;
  const imagePosition = "center center";
  
  const cartItem = items.find(i => i.id === item.id);
  const isInCart = !!cartItem;

  const handleAddToCart = () => {
    if (!item.price) return;
    
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en || null,
      price: item.price,
      image: image || undefined,
      serving_info: servingInfo || undefined,
      category: 'platter',
    }, quantity);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      {image ? (
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
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif font-medium text-xl mb-1">{name}</h3>
        {servingInfo && (
          <p className="text-sm text-primary/80 mb-2">{servingInfo}</p>
        )}
        {description && (
          <p className="text-base text-muted-foreground mb-3 whitespace-pre-line line-clamp-4">{description}</p>
        )}
        
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
            {isInCart && !isAdded && (
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

const BuffetPlatten = () => {
  const { language } = useLanguage();
  const { data: menu, isLoading, error } = useCateringMenuBySlug("buffet-platten");

  const title = language === 'en' && menu?.title_en ? menu.title_en : menu?.title;
  const subtitle = language === 'en' && menu?.subtitle_en ? menu.subtitle_en : menu?.subtitle;

  // Flatten all items from all categories
  const allItems = menu?.categories.flatMap(cat => cat.items) || [];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Platten & Sharing | STORIA Catering München" : "Platters & Sharing | STORIA Catering Munich"}
        description={language === 'de' ? "Italienische Antipasti-Platten für Meetings & Feiern: Vitello Tonnato, Bruschette, Käse & mehr. STORIA Catering München – Jetzt bestellen!" : "Italian antipasti platters for meetings & celebrations: Vitello Tonnato, bruschetta, cheese & more. STORIA Catering Munich – Order now!"}
        canonical="/catering/buffet-platten"
      />
      {allItems.length > 0 && (
        <StructuredData
          type="product"
          breadcrumbs={[
            { name: 'Home', url: '/' },
            { name: 'Catering', url: '/events' },
            { name: 'Platten & Sharing', url: '/catering/buffet-platten' },
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
                  title || (language === 'de' ? 'Platten & Sharing-Gerichte' : 'Platters & Sharing Dishes')
                )}
              </h1>
              {isLoading ? (
                <Skeleton className="h-20 w-full max-w-2xl mx-auto" />
              ) : (
                <p className="text-xl text-muted-foreground">
                  {subtitle || (language === 'de' 
                    ? 'Perfekt zum Teilen in geselliger Runde – servierfertig, stilvoll und frisch.'
                    : 'Perfect for sharing in good company – ready to serve, stylish and fresh.')}
                </p>
              )}
            </div>

            {/* Steinhofenbrot Info */}
            <HighlightCard
              icon={Wheat}
              title="Hausgemachtes Steinhofenbrot"
              title_en="Homemade Stone Oven Bread"
              description="Zu jeder Platte servieren wir unser frisch gebackenes Brot aus dem Steinofen."
              description_en="We serve our freshly baked stone oven bread with every platter."
              className="max-w-3xl mx-auto mb-8"
            />

            {/* Menu Grid */}
            <h2 className="sr-only">
              {language === 'de' ? 'Unsere Platten' : 'Our Platters'}
            </h2>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {allItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} language={language} />
                ))}
              </div>
            )}

            <p className="text-center text-muted-foreground mt-8 italic">
              {language === 'de' 
                ? 'Alle Platten können nach Ihren Wünschen angepasst werden.'
                : 'All platters can be customized to your preferences.'}
            </p>

            {/* Zusatzleistungen */}
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

export default BuffetPlatten;
