import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Check, Minus, Plus, ShoppingCart, Sparkles, Mail, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPackage } from "@/hooks/useEventPackages";
import EventPackageInquiryDialog from "./EventPackageInquiryDialog";
import { 
  calculateEventPackagePrice, 
  isLocationPackage, 
  getLocationPricingBreakdown,
  LOCATION_BASE_GUESTS 
} from "@/lib/eventPricing";

// Package images from STORIA website
import sommerfest from "@/assets/events/sommerfest.webp";
import ravioliDinner from "@/assets/events/ravioli-dinner.webp";
import firmenfeier from "@/assets/events/firmenfeier.webp";

// Get image for package by matching name patterns
const getPackageImage = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("business") || nameLower.includes("dinner")) {
    return ravioliDinner; // High-quality pasta for dinner
  }
  if (nameLower.includes("network") || nameLower.includes("aperitivo")) {
    return sommerfest; // Elegant aperitivo atmosphere
  }
  if (nameLower.includes("location") || nameLower.includes("gesamte")) {
    return firmenfeier; // Elegant event atmosphere
  }
  return ravioliDinner; // Default fallback
};

interface EventPackageShopCardProps {
  pkg: EventPackage;
  featured?: boolean;
}

const EventPackageShopCard = ({ pkg, featured }: EventPackageShopCardProps) => {
  const { language } = useLanguage();
  const { addToCart, items } = useCart();
  const { formatPrice } = usePriceDisplay();
  const [guestCount, setGuestCount] = useState(pkg.min_guests || 20);
  const [isAdded, setIsAdded] = useState(false);
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);

  const cartItem = items.find(i => i.id === `event-${pkg.id}`);
  const isInCart = !!cartItem;

  const name = language === 'de' ? pkg.name : (pkg.name_en || pkg.name);
  const description = language === 'de' ? pkg.description : (pkg.description_en || pkg.description);
  const includes = pkg.includes || [];
  const image = getPackageImage(pkg.name);

  const minGuests = pkg.min_guests || 1;
  const maxGuests = pkg.max_guests || 200;

  const handleDecrement = () => {
    setGuestCount(prev => Math.max(minGuests, prev - 1));
  };

  const handleIncrement = () => {
    setGuestCount(prev => Math.min(maxGuests, prev + 1));
  };

  // Use centralized pricing calculation
  const totalPrice = calculateEventPackagePrice(
    pkg.id,
    pkg.price,
    guestCount,
    !!pkg.price_per_person
  );

  // Check if this is the location package with tiered pricing
  const isLocationPkg = isLocationPackage(pkg.id, pkg.price);
  const hasTieredPricing = isLocationPkg && guestCount > LOCATION_BASE_GUESTS;
  const pricingBreakdown = isLocationPkg ? getLocationPricingBreakdown(guestCount) : null;

  const handleAddToCart = () => {
    // For tiered pricing, store the effective unit price so cart calculation works
    const effectivePrice = totalPrice / guestCount;
    
    addToCart({
      id: `event-${pkg.id}`,
      name: pkg.name,
      name_en: pkg.name_en,
      price: effectivePrice,
      category: 'equipment',
      serving_info: pkg.price_per_person 
        ? (language === 'de' ? 'Pro Person' : 'Per Person')
        : isLocationPkg
          ? (language === 'de' ? 'ab 70 Pers.' : 'from 70 guests')
          : (language === 'de' ? 'Pauschalpreis' : 'Flat Rate'),
      isEventPackage: true,
      baseGuestCount: isLocationPkg ? LOCATION_BASE_GUESTS : undefined,
      packageId: pkg.id,
    }, guestCount);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  // Price unit text
  const priceUnit = pkg.price_per_person 
    ? (language === 'de' ? 'p.P.' : 'p.p.')
    : isLocationPkg
      ? (language === 'de' ? 'ab 70 Pers.' : 'from 70 guests')
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
        <h3 className="font-serif text-2xl md:text-3xl font-medium">{name}</h3>
        
        {/* Drinks included badge */}
        <Badge variant="secondary" className="mt-2 mx-auto text-sm">
          {language === 'de' ? 'Inkl. Getränke-Paket' : 'Drinks Package Included'}
        </Badge>
        
        {/* Price Display */}
        <div className="mt-3">
          <span className="text-4xl font-bold text-primary">{formatPrice(pkg.price)}</span>
          <span className="text-base text-muted-foreground ml-1">{priceUnit}</span>
        </div>
        
        {/* Min/Max guests info */}
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {pkg.min_guests && (
            <p>{language === 'de' ? `ab ${pkg.min_guests} Personen` : `from ${pkg.min_guests} guests`}</p>
          )}
          {pkg.max_guests && (
            <p>{language === 'de' ? `max. ${pkg.max_guests} Personen` : `max. ${pkg.max_guests} guests`}</p>
          )}
          {/* Exclusivity info for Business Dinner */}
          {(pkg.name.toLowerCase().includes('business') || pkg.name.toLowerCase().includes('dinner')) && (
            <p className="text-primary font-medium">
              {language === 'de' ? 'Exklusiver Raum ab 40 Personen' : 'Exclusive room from 40 guests'}
            </p>
          )}
        </div>

        {description && (
          <p className="text-base text-muted-foreground mt-2">{description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        {/* Includes List */}
        <ul className="space-y-3">
          {includes.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-lg">
              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground/80">{item}</span>
            </li>
          ))}
        </ul>

        {/* Dietary Options Badge */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-base text-muted-foreground mb-2">
            {language === 'de' ? 'Verfügbare Optionen:' : 'Available options:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['Vegan', 'Vegetarisch', 'Fisch', 'Fleisch'].map(opt => (
              <Badge key={opt} variant="outline" className="text-xs px-2 py-0.5 font-normal">
                {opt}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-4 border-t">
        {/* Guest Count Selector */}
        <div className="w-full">
          <label className="text-base text-muted-foreground block mb-2 text-center">
            {language === 'de' ? 'Anzahl Gäste' : 'Number of Guests'}
          </label>
          <div className="flex items-center justify-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10"
              onClick={handleDecrement}
              disabled={guestCount <= minGuests}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <span className="text-2xl font-semibold w-16 text-center">{guestCount}</span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-10 w-10"
              onClick={handleIncrement}
              disabled={guestCount >= maxGuests}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Total Price - for per-person OR tiered pricing */}
        {(pkg.price_per_person || hasTieredPricing || totalPrice !== pkg.price) && (
          <div className="text-center">
            <span className="text-base text-muted-foreground">
              {language === 'de' ? 'Gesamt:' : 'Total:'} 
            </span>
            <span className="text-xl font-bold text-primary ml-2">
              {formatPrice(totalPrice)}
            </span>
            {/* Explanation for tiered pricing */}
            {hasTieredPricing && pricingBreakdown && (
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'de' 
                  ? `Basis 8.500 € + ${pricingBreakdown.extraGuests} Pers. × 121,43 €`
                  : `Base €8,500 + ${pricingBreakdown.extraGuests} guests × €121.43`}
              </p>
            )}
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

        {/* Checkout Button - appears when item is in cart */}
        {isInCart && !isAdded && (
          <Button
            asChild
            variant="checkoutCta"
            size="lg"
            className="w-full gap-2"
          >
            <Link to="/checkout">
              {language === 'de' ? 'Zur Kasse' : 'Checkout'}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        )}

        {/* Get Quote Button */}
        <Button
          variant="outline"
          onClick={() => setInquiryDialogOpen(true)}
          className="w-full gap-2 bg-background hover:bg-muted"
          size="lg"
        >
          <Mail className="h-5 w-5" />
          {language === 'de' ? 'Angebot erhalten' : 'Get Quote'}
        </Button>
      </CardFooter>

      {/* Inquiry Dialog */}
      <EventPackageInquiryDialog
        open={inquiryDialogOpen}
        onOpenChange={setInquiryDialogOpen}
        packageId={pkg.id}
        packageName={pkg.name}
        packageNameEn={pkg.name_en}
        initialGuestCount={guestCount}
        pricePerPerson={pkg.price}
        minGuests={pkg.min_guests || 10}
      />
    </Card>
  );
};

export default EventPackageShopCard;
