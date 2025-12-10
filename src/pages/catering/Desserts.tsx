import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { ServicesGrid } from '@/components/catering/ServiceInfoCard';
import SEO from '@/components/SEO';
import StructuredData from '@/components/StructuredData';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart, Check } from 'lucide-react';
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
    <div className="bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      <div className="aspect-square overflow-hidden relative">
        <img
          src={item.image}
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
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-serif font-medium text-lg mb-1">{name}</h3>
        <p className="text-xs text-primary/80 mb-2">{servingInfo}</p>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-4">{description}</p>
        
        <div className="flex justify-between items-end mb-3">
          <p className="text-xs text-muted-foreground">{minOrder}</p>
          <span className="font-semibold text-primary text-lg">
            {formatPrice(item.price)}
          </span>
        </div>

        {/* Add to Cart Controls */}
        <div className="flex items-center gap-2 mt-auto">
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
      <StructuredData 
        type="product" 
        products={dessertItems.map(d => ({
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
      
      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-serif font-medium mb-6">
              {language === 'de' ? 'Desserts' : 'Desserts'}
            </h1>
            <p className="text-lg text-muted-foreground">
              {language === 'de' 
                ? 'Süße Verführungen im Glas – perfekt für Ihr Catering-Event'
                : 'Sweet temptations in a glass – perfect for your catering event'}
            </p>
          </div>

          {/* Products Grid */}
          <h2 className="sr-only">
            {language === 'de' ? 'Unsere Desserts' : 'Our Desserts'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {dessertItems.map((item) => (
              <DessertCard key={item.id} item={item} language={language} />
            ))}
          </div>

          {/* Additional Services */}
          <ServicesGrid 
            title={language === 'de' ? 'Zusatzleistungen' : 'Additional Services'}
            className="mt-16"
          />
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Desserts;
