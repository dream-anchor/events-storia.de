import { useState } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
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
import { Plus, Minus, ShoppingCart, Check, ArrowRight } from "lucide-react";
import { ServicesGrid } from "@/components/catering/ServiceInfoCard";

interface DessertCardProps {
  item: CateringMenuItem;
  language: string;
}

const DessertCard = ({ item, language }: DessertCardProps) => {
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(4);
  const [justAdded, setJustAdded] = useState(false);

  const name = language === 'en' && item.name_en ? item.name_en : item.name;
  const description = language === 'en' && item.description_en ? item.description_en : item.description;
  const minOrder = language === 'en' && item.min_order_en ? item.min_order_en : item.min_order;
  const servingInfo = language === 'en' && item.serving_info_en ? item.serving_info_en : item.serving_info;

  const cartItem = items.find(i => i.id === item.id);
  const isInCart = !!cartItem;

  const handleAddToCart = () => {
    if (!item.price) return;
    
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en || null,
      price: item.price,
      image: item.image_url || undefined,
      serving_info: servingInfo || undefined,
      min_order: 4,
      category: 'dessert',
    }, quantity);
    
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      {item.image_url && (
        <div className="aspect-square overflow-hidden relative">
          <img
            src={item.image_url}
            alt={`${name} – STORIA Catering München`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          {minOrder && <p className="text-sm text-muted-foreground">{minOrder}</p>}
          {item.price && (
            <span className="font-semibold text-primary text-xl">
              {formatPrice(item.price)}
            </span>
          )}
        </div>

        {/* Add to Cart Controls */}
        <div className="flex flex-col gap-2 mt-auto">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-md">
              <button
                onClick={() => setQuantity(Math.max(4, quantity - 1))}
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
              className={`flex-1 transition-all ${justAdded ? 'bg-green-600 hover:bg-green-600' : ''}`}
              disabled={!item.price}
            >
              {justAdded ? (
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
          {isInCart && !justAdded && (
            <Button
              asChild
              variant="checkoutCta"
              size="sm"
              className="w-full"
            >
              <LocalizedLink to="checkout">
                {language === 'de' ? 'Zur Kasse' : 'Checkout'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </LocalizedLink>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Desserts = () => {
  const { t, language } = useLanguage();
  const { data: menu, isLoading, error } = useCateringMenuBySlug('desserts');

  // Get all items from all categories
  const allItems = menu?.categories.flatMap(cat => cat.items) || [];

  return (
    <>
      <SEO
        title={t.seo.cateringDesserts.title}
        description={t.seo.cateringDesserts.description}
      />
      {allItems.length > 0 && (
        <StructuredData
          type="product"
          breadcrumbs={[
            { name: 'Home', url: '/' },
            { name: 'Catering', url: '/events' },
            { name: 'Desserts', url: '/catering/desserts' },
          ]}
          products={allItems.map(item => ({
            name: item.name,
            name_en: item.name_en ?? '',
            description: item.description ?? '',
            description_en: item.description_en ?? '',
            price: item.price || 0,
            image: item.image_url ?? undefined,
            sku: item.id,
            servingInfo: item.serving_info ?? undefined,
          }))}
        />
      )}
      <Header />
      <Navigation />
      <div className="min-h-screen flex flex-col bg-background">
      
      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-serif font-medium mb-6">
              {language === 'de' ? 'Desserts' : 'Desserts'}
            </h1>
            <p className="text-xl text-muted-foreground">
              {language === 'de' 
                ? 'Süße Verführungen im Glas – perfekt für Ihr Catering-Event'
                : 'Sweet temptations in a glass – perfect for your catering event'}
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[1, 2].map(i => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12 text-muted-foreground">
              {language === 'de' 
                ? 'Fehler beim Laden der Desserts.' 
                : 'Error loading desserts.'}
            </div>
          )}

          {/* Products Grid */}
          {!isLoading && !error && (
            <>
              <h2 className="sr-only">
                {language === 'de' ? 'Unsere Desserts' : 'Our Desserts'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {allItems.map((item) => (
                  <DessertCard key={item.id} item={item} language={language} />
                ))}
              </div>
            </>
          )}

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

export default Desserts;
