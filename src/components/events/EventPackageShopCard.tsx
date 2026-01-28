import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Check, Users, Minus, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPackage } from "@/hooks/useEventPackages";

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
      category: 'equipment', // Using equipment category for events
      serving_info: pkg.price_per_person 
        ? (language === 'de' ? 'Pro Person' : 'Per Person')
        : (language === 'de' ? 'Pauschalpreis' : 'Flat Rate'),
    }, guestCount);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  return (
    <Card className={cn(
      "relative flex flex-col h-full transition-all duration-300 hover:shadow-xl",
      featured && "ring-2 ring-primary shadow-lg scale-[1.02]"
    )}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="gap-1 px-4 py-1 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            {language === 'de' ? 'Beliebt' : 'Popular'}
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <h3 className="font-serif text-xl md:text-2xl font-medium">{name}</h3>
        <div className="mt-3">
          <span className="text-3xl md:text-4xl font-bold text-primary">
            {formatPrice(pkg.price)}
          </span>
          {pkg.price_per_person && (
            <span className="text-muted-foreground text-sm ml-1">
              {language === 'de' ? '/ Person' : '/ guest'}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        {/* Guest Count Info */}
        <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {language === 'de' 
              ? `${minGuests} – ${maxGuests} Personen`
              : `${minGuests} – ${maxGuests} guests`}
          </span>
        </div>

        {/* Includes List */}
        <ul className="space-y-2.5">
          {includes.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{item}</span>
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
