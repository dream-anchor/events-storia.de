import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Users, Minus, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPackage } from "@/hooks/useEventPackages";

// Package images - use public folder images from database
import packageExklusiv from "@/assets/events/package-exklusiv.webp";

// Get image for package by matching name patterns
const getPackageImage = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("business") || nameLower.includes("dinner")) {
    return "/catering/festmenus/hero.webp"; // Festive dinner atmosphere
  }
  if (nameLower.includes("network") || nameLower.includes("aperitivo")) {
    return "/catering/flying-buffet/hero.webp"; // Fingerfood/aperitivo atmosphere
  }
  if (nameLower.includes("location") || nameLower.includes("gesamte")) {
    return packageExklusiv; // Opulent banquet
  }
  return "/catering/festmenus/hero.webp"; // Default fallback
};

interface EventPackageShopCardProps {
  pkg: EventPackage;
  featured?: boolean;
}

const EventPackageShopCard = ({ pkg, featured }: EventPackageShopCardProps) => {
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [guestCount, setGuestCount] = useState(pkg.min_guests || 20);
  const [isAdded, setIsAdded] = useState(false);

  const name = language === 'de' ? pkg.name : (pkg.name_en || pkg.name);
  const description = language === 'de' ? pkg.description : (pkg.description_en || pkg.description);
  const includes = pkg.includes || [];
  const image = getPackageImage(pkg.name);

  const minGuests = pkg.min_guests || 1;
  const maxGuests = pkg.max_guests || 200;

  const handleDecrement = () => {
    setGuestCount(prev => Math.max(minGuests, prev - 5));
  };

  const handleIncrement = () => {
    setGuestCount(prev => Math.min(maxGuests, prev + 5));
  };

  const totalPrice = pkg.price_per_person ? pkg.price * guestCount : pkg.price;

  const handleAddToCart = () => {
    addToCart({
      id: `event-${pkg.id}`,
      name: pkg.name,
      name_en: pkg.name_en,
      price: pkg.price,
      category: 'equipment',
      serving_info: pkg.price_per_person 
        ? (language === 'de' ? 'Pro Person' : 'Per Person')
        : (language === 'de' ? 'Pauschalpreis' : 'Flat Rate'),
    }, guestCount);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  // Price unit text
  const priceUnit = pkg.price_per_person 
    ? (language === 'de' ? 'p.P.' : 'p.p.')
    : (language === 'de' ? 'pauschal' : 'flat rate');

  return (
    <Card className={cn(
      "relative flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-xl",
      featured && "ring-2 ring-primary shadow-lg md:scale-[1.02] z-10"
    )}>
      {/* Featured Badge */}
      {featured && (
        <div className="absolute top-4 right-4 z-20">
          <Badge className="gap-1.5 px-3 py-1 text-xs font-medium shadow-lg">
            <Sparkles className="h-3 w-3" />
            {language === 'de' ? 'Beliebteste Wahl' : 'Most Popular'}
          </Badge>
        </div>
      )}

      {/* Header Image */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <CardHeader className="text-center pt-6 pb-2">
        <h3 className="font-serif text-xl md:text-2xl font-medium">{name}</h3>
        
        {/* Price Display */}
        <div className="mt-3">
          <span className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</span>
          <span className="text-sm text-muted-foreground ml-1">{priceUnit}</span>
        </div>
        
        {/* Min guests info */}
        {pkg.min_guests && (
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'de' ? `ab ${pkg.min_guests} Personen` : `from ${pkg.min_guests} guests`}
          </p>
        )}

        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        {/* Includes List */}
        <ul className="space-y-2.5">
          {includes.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground/80">{item}</span>
            </li>
          ))}
        </ul>

        {/* Dietary Options Badge */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">
            {language === 'de' ? 'Verfügbare Optionen:' : 'Available options:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['Vegan', 'Vegetarisch', 'Fisch', 'Fleisch'].map(opt => (
              <Badge key={opt} variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                {opt}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-4 border-t">
        {/* Guest Count Selector */}
        <div className="w-full">
          <label className="text-xs text-muted-foreground block mb-2 text-center">
            {language === 'de' ? 'Anzahl Gäste' : 'Number of Guests'}
          </label>
          <div className="flex items-center justify-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-9 w-9"
              onClick={handleDecrement}
              disabled={guestCount <= minGuests}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-xl font-semibold w-16 text-center">{guestCount}</span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-9 w-9"
              onClick={handleIncrement}
              disabled={guestCount >= maxGuests}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Total Price */}
        {pkg.price_per_person && (
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {language === 'de' ? 'Gesamt:' : 'Total:'} 
            </span>
            <span className="text-lg font-bold text-primary ml-2">
              {formatPrice(totalPrice)}
            </span>
          </div>
        )}

        {/* Add to Cart Button */}
        <Button 
          onClick={handleAddToCart}
          className={cn(
            "w-full gap-2 transition-all",
            isAdded && "bg-primary/80"
          )}
          size="lg"
        >
          {isAdded ? (
            <>
              <Check className="h-5 w-5" />
              {language === 'de' ? 'Hinzugefügt!' : 'Added!'}
            </>
          ) : (
            <>
              <ShoppingCart className="h-5 w-5" />
              {language === 'de' ? 'Zum Warenkorb' : 'Add to Cart'}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EventPackageShopCard;
