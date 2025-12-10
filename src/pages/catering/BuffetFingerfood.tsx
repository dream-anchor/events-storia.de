import { useState } from "react";
import Header from "@/components/Header";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CateringCTA from "@/components/CateringCTA";
import SEO from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useCateringMenuBySlug, CateringMenuItem } from "@/hooks/useCateringMenus";
import { useCart } from "@/contexts/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingCart, Check } from "lucide-react";
import { ServicesGrid } from "@/components/catering/ServiceInfoCard";

// Import images
import grillgemueseImg from "@/assets/catering/fingerfood/grillgemuese.webp";
import auberginenImg from "@/assets/catering/fingerfood/auberginen.webp";
import frittataImg from "@/assets/catering/fingerfood/frittata.webp";
import caponataImg from "@/assets/catering/fingerfood/caponata.webp";
import burratinaImg from "@/assets/catering/fingerfood/burratina.webp";
import oktopusImg from "@/assets/catering/fingerfood/oktopus.webp";
import avocadoGarnelenImg from "@/assets/catering/fingerfood/avocado-garnelen.webp";
import meeresfruchteImg from "@/assets/catering/fingerfood/meeresfruechte.webp";
// Map item names to images
const imageMap: Record<string, string> = {
  "Grillgemüse": grillgemueseImg,
  "Auberginenbällchen": auberginenImg,
  "Mini-Frittata mit Zucchini": frittataImg,
  "Caponata siciliana": caponataImg,
  "Burratina": burratinaImg,
  "Oktopus-Kartoffelsalat": oktopusImg,
  "Avocadocreme mit Garnelen": avocadoGarnelenImg,
  "Meeresfrüchtesalat": meeresfruchteImg,
};

// Image position map to focus on the food
const imagePositionMap: Record<string, string> = {
  "Grillgemüse": "center center",
  "Auberginenbällchen": "center 40%",
  "Mini-Frittata mit Zucchini": "center 35%",
  "Caponata siciliana": "center center",
  "Burratina": "center 45%",
  "Oktopus-Kartoffelsalat": "center 40%",
  "Avocadocreme mit Garnelen": "center center",
  "Meeresfrüchtesalat": "center 40%",
};

interface MenuItemCardProps {
  item: CateringMenuItem;
  language: string;
}

const MenuItemCard = ({ item, language }: MenuItemCardProps) => {
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(4);
  const [isAdded, setIsAdded] = useState(false);
  
  const name = language === 'en' && item.name_en ? item.name_en : item.name;
  const description = language === 'en' && item.description_en ? item.description_en : item.description;
  const servingInfo = language === 'en' && item.serving_info_en ? item.serving_info_en : item.serving_info;
  const minOrder = language === 'en' && item.min_order_en ? item.min_order_en : item.min_order;
  const image = imageMap[item.name] || item.image_url;
  const imagePosition = imagePositionMap[item.name] || "center center";
  
  const cartItem = items.find(i => i.id === item.id);
  const isInCart = !!cartItem;

  const handleAddToCart = () => {
    if (!item.price) return;
    
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en || null,
      price: item.price,
      image,
      serving_info: servingInfo || undefined,
      min_order: 4,
      category: 'buffet',
    }, quantity);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group">
      {image && (
        <div className="aspect-square overflow-hidden relative">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ objectPosition: imagePosition }}
          />
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
        {servingInfo && (
          <p className="text-xs text-primary/80 mb-2">{servingInfo}</p>
        )}
        {description && (
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
        )}
        
        <div className="flex justify-between items-end mb-3">
          <div>
            {minOrder && (
              <p className="text-xs text-muted-foreground">{minOrder}</p>
            )}
          </div>
          <div className="text-right">
            {item.price ? (
              <span className="font-semibold text-primary">
                {formatPrice(item.price)}
              </span>
            ) : item.price_display ? (
              <span className="font-semibold text-primary">{item.price_display}</span>
            ) : null}
          </div>
        </div>

        {/* Add to Cart Controls */}
        {item.price && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-md">
              <button
                onClick={() => setQuantity(q => Math.max(4, q - 1))}
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
        )}
      </div>
    </div>
  );
};

const BuffetFingerfood = () => {
  const { language } = useLanguage();
  const { data: menu, isLoading, error } = useCateringMenuBySlug("buffet-fingerfood");

  const title = language === 'en' && menu?.title_en ? menu.title_en : menu?.title;
  const subtitle = language === 'en' && menu?.subtitle_en ? menu.subtitle_en : menu?.subtitle;
  const additionalInfo = language === 'en' && menu?.additional_info_en ? menu.additional_info_en : menu?.additional_info;

  // Flatten all items from all categories
  const allItems = menu?.categories.flatMap(cat => cat.items) || [];

  return (
    <>
      <SEO 
        title={language === 'de' ? "Fingerfood & Mini-Gerichte | STORIA Catering München" : "Finger Food & Mini Dishes | STORIA Catering Munich"}
        description={language === 'de' ? "Italienisches Fingerfood für Events in München bestellen: Bruschette, Oktopus, Burrata & mehr. Lieferung & Abholung. Jetzt online buchen!" : "Order Italian finger food for events in Munich: bruschetta, octopus, burrata & more. Delivery & pickup available. Book online now!"}
        canonical="/catering/buffet-fingerfood"
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1">
          <section className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
                {isLoading ? (
                  <Skeleton className="h-10 w-64 mx-auto" />
                ) : (
                  title || (language === 'de' ? 'Buffet / Fingerfood' : 'Buffet / Finger Food')
                )}
              </h1>
              {isLoading ? (
                <Skeleton className="h-20 w-full max-w-2xl mx-auto" />
              ) : (
                <p className="text-lg text-muted-foreground">
                  {subtitle || (language === 'de' 
                    ? 'Elegante Häppchen für Empfänge, Meetings & gesellige Runden. Unsere Fingerfood-Auswahl ist perfekt für jeden Anlass – von Business-Events bis hin zu privaten Feiern.'
                    : 'Elegant bites for receptions, meetings & social gatherings. Our finger food selection is perfect for any occasion – from business events to private celebrations.')}
                </p>
              )}
            </div>

            {/* Menu Grid */}
            <h2 className="sr-only">
              {language === 'de' ? 'Unsere Gerichte' : 'Our Dishes'}
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

            {/* Additional Services */}
            {!isLoading && !error && allItems.length > 0 && (
              <ServicesGrid 
                title={language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
                className="mt-16"
              />
            )}

            {!isLoading && !error && allItems.length > 0 && (
              <p className="text-center text-muted-foreground mt-8 italic">
                {language === 'de' 
                  ? 'Individuelle Zusammenstellung auf Anfrage möglich.'
                  : 'Custom selection available upon request.'}
              </p>
            )}
          </section>
          
          <CateringCTA />
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default BuffetFingerfood;
