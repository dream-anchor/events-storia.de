import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { ServicesGrid } from '@/components/catering/ServiceInfoCard';
import SEO from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingBag, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import tiramisuImg from '@/assets/catering/fingerfood/tiramisu.webp';
import pistazienImg from '@/assets/catering/fingerfood/pistazien.webp';

interface DessertItem {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  min_order: string;
  min_order_en: string;
  serving_info: string;
  serving_info_en: string;
  image: string;
}

const dessertItems: DessertItem[] = [
  {
    id: 'tiramisu-storia',
    name: 'Tiramisù STORIA',
    name_en: 'Tiramisù STORIA',
    description: 'Hausgemachtes Tiramisù mit Espresso, Schokoladenboden und Mascarpone.',
    description_en: 'Homemade tiramisù with espresso, chocolate base and mascarpone.',
    price: 4.50,
    min_order: 'Ab 4 Personen bestellbar',
    min_order_en: 'Minimum order for 4 people',
    serving_info: 'Ein Fingerfood-Glas pro Person',
    serving_info_en: 'One fingerfood glass per person',
    image: tiramisuImg,
  },
  {
    id: 'pistazien-toertchen',
    name: 'Pistazien-Törtchen',
    name_en: 'Pistachio Tartlet',
    description: 'Pistazientörtchen mit Vanillecreme – elegant und aromatisch.',
    description_en: 'Pistachio tartlet with vanilla cream – elegant and aromatic.',
    price: 5.80,
    min_order: 'Ab 4 Personen bestellbar',
    min_order_en: 'Minimum order for 4 people',
    serving_info: 'Ein Fingerfood-Glas pro Person',
    serving_info_en: 'One fingerfood glass per person',
    image: pistazienImg,
  },
];

const DessertCard = ({ item, language }: { item: DessertItem; language: string }) => {
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [quantity, setQuantity] = useState(4);
  const [justAdded, setJustAdded] = useState(false);

  const name = language === 'en' ? item.name_en : item.name;
  const description = language === 'en' ? item.description_en : item.description;
  const minOrder = language === 'en' ? item.min_order_en : item.min_order;
  const servingInfo = language === 'en' ? item.serving_info_en : item.serving_info;

  const cartItem = items.find(i => i.id === item.id);
  const isInCart = !!cartItem;

  const handleAddToCart = () => {
    addToCart({
      id: item.id,
      name: item.name,
      name_en: item.name_en,
      price: item.price,
      image: item.image,
      serving_info: item.serving_info,
    }, quantity);
    
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="group relative bg-card/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/50 shadow-lg hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={item.image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* In Cart Badge */}
        {isInCart && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium flex items-center gap-1.5 shadow-lg">
            <Check className="h-3 w-3" />
            {cartItem.quantity}x {language === 'de' ? 'im Warenkorb' : 'in cart'}
          </div>
        )}
        
        {/* Price Badge */}
        <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm text-foreground font-semibold shadow-lg">
          {formatPrice(item.price)}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-serif text-xl font-semibold text-foreground mb-1">{name}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="italic">{servingInfo}</p>
          <p className="font-medium text-primary">{minOrder}</p>
        </div>

        {/* Quantity & Add to Cart */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
            <button
              onClick={() => setQuantity(Math.max(4, quantity - 1))}
              className="w-8 h-8 rounded-full bg-background flex items-center justify-center hover:bg-primary/10 transition-colors"
              aria-label="Menge reduzieren"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center font-medium tabular-nums">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-full bg-background flex items-center justify-center hover:bg-primary/10 transition-colors"
              aria-label="Menge erhöhen"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            onClick={handleAddToCart}
            className={`flex-1 rounded-full transition-all duration-300 ${
              justAdded 
                ? 'bg-green-600 hover:bg-green-700' 
                : ''
            }`}
            size="sm"
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {language === 'de' ? 'Hinzugefügt' : 'Added'}
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 mr-2" />
                {language === 'de' ? 'Hinzufügen' : 'Add to Cart'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Desserts = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={language === 'de' ? 'Desserts | STORIA Catering München' : 'Desserts | STORIA Catering Munich'}
        description={language === 'de' 
          ? 'Italienische Desserts für Ihr Catering: Hausgemachtes Tiramisù & Pistazien-Törtchen. Ab 4 Personen bestellbar. STORIA München.'
          : 'Italian desserts for your catering: homemade tiramisù & pistachio tartlets. Minimum order 4 people. STORIA Munich.'}
      />
      <Header />
      <Navigation />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              {language === 'de' ? 'Desserts' : 'Desserts'}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {language === 'de' 
                ? 'Süße Verführungen im Glas – perfekt für Ihr Catering-Event'
                : 'Sweet temptations in a glass – perfect for your catering event'}
            </p>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="sr-only">
              {language === 'de' ? 'Unsere Desserts' : 'Our Desserts'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
              {dessertItems.map((item) => (
                <DessertCard key={item.id} item={item} language={language} />
              ))}
            </div>
          </div>
        </section>

        {/* Service Info */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <ServicesGrid 
              title={language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Desserts;
