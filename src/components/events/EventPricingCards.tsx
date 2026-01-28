import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { useEventPackages } from "@/hooks/useEventPackages";
import { cn } from "@/lib/utils";

// Fallback images for packages without database images
import packageEssenz from "@/assets/events/package-essenz.webp";
import packagePremium from "@/assets/events/package-premium.webp";
import packageExklusiv from "@/assets/events/package-exklusiv.webp";

// Map package names to images
const packageImages: Record<string, string> = {
  "business-dinner": packageEssenz,
  "network-aperitivo": packagePremium,
  "gesamte-location": packageExklusiv,
};

// Get image for package by matching name patterns
const getPackageImage = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("business") || nameLower.includes("dinner")) {
    return packageEssenz;
  }
  if (nameLower.includes("network") || nameLower.includes("aperitivo")) {
    return packagePremium;
  }
  if (nameLower.includes("location") || nameLower.includes("gesamte")) {
    return packageExklusiv;
  }
  return packageEssenz; // Default fallback
};

interface EventPricingCardsProps {
  onInquiry?: (packageId: string) => void;
}

const EventPricingCards = ({ onInquiry }: EventPricingCardsProps) => {
  const { language } = useLanguage();
  const { showGross, setShowGross, formatPrice } = usePriceDisplay();
  const { data: packages, isLoading } = useEventPackages();

  // Featured package is "Business Dinner" (most expensive per-person package)
  const getFeaturedId = () => {
    if (!packages) return null;
    const businessDinner = packages.find(p => 
      p.name.toLowerCase().includes("business") || p.name.toLowerCase().includes("dinner")
    );
    return businessDinner?.id || null;
  };

  const featuredId = getFeaturedId();

  if (isLoading) {
    return (
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[500px] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4">
            {language === 'de' ? "Unsere Event-Pakete" : "Our Event Packages"}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {language === 'de'
              ? "Wählen Sie das perfekte Paket für Ihren besonderen Anlass"
              : "Choose the perfect package for your special occasion"}
          </p>
        </div>

        {/* Brutto/Netto Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Label 
            htmlFor="price-toggle" 
            className={cn(
              "text-sm cursor-pointer transition-colors",
              !showGross ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            {language === 'de' ? 'Netto' : 'Net'}
          </Label>
          <Switch
            id="price-toggle"
            checked={showGross}
            onCheckedChange={setShowGross}
          />
          <Label 
            htmlFor="price-toggle" 
            className={cn(
              "text-sm cursor-pointer transition-colors",
              showGross ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            {language === 'de' ? 'Brutto' : 'Gross'}
          </Label>
          <span className="text-xs text-muted-foreground ml-2">
            ({language === 'de' ? 'inkl. 7% MwSt.' : 'incl. 7% VAT'})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
          {packages?.map((pkg) => {
            const name = language === 'de' ? pkg.name : (pkg.name_en || pkg.name);
            const description = language === 'de' ? pkg.description : (pkg.description_en || pkg.description);
            const includes = pkg.includes || [];
            const isFeatured = pkg.id === featuredId;
            const image = getPackageImage(pkg.name);

            // Format price using the price display context
            const displayPrice = formatPrice(pkg.price);
            
            // Price unit text
            const priceUnit = pkg.price_per_person 
              ? (language === 'de' ? 'p.P.' : 'p.p.')
              : (language === 'de' ? 'pauschal' : 'flat rate');

            return (
              <Card 
                key={pkg.id} 
                className={cn(
                  "relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl",
                  isFeatured && "ring-2 ring-primary md:scale-105 shadow-xl z-10"
                )}
              >
                {/* Featured Badge */}
                {isFeatured && (
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
                  <h3 className="text-xl md:text-2xl font-serif font-medium">{name}</h3>
                  
                  {/* Price Display */}
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-primary">{displayPrice}</span>
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
                  <ul className="space-y-3">
                    {includes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-6 pb-6">
                  <Button 
                    onClick={() => onInquiry?.(pkg.id)}
                    className={cn(
                      "w-full gap-2",
                      isFeatured ? "bg-primary hover:bg-primary/90" : ""
                    )}
                    variant={isFeatured ? "default" : "outline"}
                    size="lg"
                  >
                    {language === 'de' ? 'Anfragen' : 'Inquire'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* VAT Note */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            {showGross 
              ? (language === 'de' ? 'Alle Preise inkl. 7% MwSt.' : 'All prices incl. 7% VAT')
              : (language === 'de' ? 'Alle Preise zzgl. 7% MwSt.' : 'All prices excl. 7% VAT')}
          </p>
        </div>

        {/* Additional Services Note */}
        <div className="text-center mt-10 max-w-2xl mx-auto">
          <p className="text-lg text-muted-foreground leading-relaxed">
            {language === 'de' 
              ? 'Gerne können Sie weitere Gänge und Getränke-Pakete dazubuchen. Gerne beraten wir Sie individuell telefonisch oder per E-Mail. Kontaktieren Sie uns einfach. Wir freuen uns auf Sie.'
              : 'You are welcome to book additional courses and beverage packages. We are happy to advise you individually by phone or email. Simply contact us. We look forward to hearing from you.'}
          </p>
        </div>
      </div>
    </section>
  );
};

export default EventPricingCards;
