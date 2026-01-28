import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import packageEssenz from "@/assets/events/package-essenz.webp";
import packagePremium from "@/assets/events/package-premium.webp";
import packageExklusiv from "@/assets/events/package-exklusiv.webp";

interface PricingPackage {
  id: string;
  image: string;
  name: string;
  nameEn: string;
  price: string;
  priceEn: string;
  priceUnit: string;
  priceUnitEn: string;
  minGuests?: number;
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  featured?: boolean;
}

const pricingPackages: PricingPackage[] = [
  {
    id: "network-aperitivo",
    image: packagePremium,
    name: "Network-Aperitivo",
    nameEn: "Network Aperitivo",
    price: "69",
    priceEn: "69",
    priceUnit: "p.P.",
    priceUnitEn: "p.p.",
    minGuests: 20,
    description: "Italienisches Networking-Erlebnis",
    descriptionEn: "Italian networking experience",
    features: [
      "Italienisches Fingerfood-Buffet",
      "Live-Pasta-Station",
      "Ausgewählte Weine & Cocktails",
      "Ab 20 Personen buchbar",
    ],
    featuresEn: [
      "Italian finger food buffet",
      "Live pasta station",
      "Selected wines & cocktails",
      "Bookable from 20 guests",
    ],
  },
  {
    id: "business-dinner",
    image: packageEssenz,
    name: "Business Dinner – Exclusive",
    nameEn: "Business Dinner – Exclusive",
    price: "99",
    priceEn: "99",
    priceUnit: "p.P.",
    priceUnitEn: "p.p.",
    minGuests: 30,
    description: "Exklusives Dinner für Geschäftskunden",
    descriptionEn: "Exclusive dinner for business clients",
    features: [
      "Italienische Vorspeisenplatte",
      "Hochwertiger Hauptgang nach Wahl",
      "Hausgemachtes Dessert",
      "Ab 30 Personen buchbar",
    ],
    featuresEn: [
      "Italian starter platter",
      "Premium main course of choice",
      "Homemade dessert",
      "Bookable from 30 guests",
    ],
    featured: true,
  },
  {
    id: "gesamte-location",
    image: packageExklusiv,
    name: "Gesamte Location",
    nameEn: "Full Venue Buyout",
    price: "8.500",
    priceEn: "8,500",
    priceUnit: "pauschal",
    priceUnitEn: "flat rate",
    description: "Das komplette STORIA exklusiv für Sie",
    descriptionEn: "The entire STORIA exclusively for you",
    features: [
      "Bis zu 100 Gäste sitzend",
      "Bis zu 180 Gäste stehend",
      "Komplette Exklusivität",
      "Catering nach Absprache",
    ],
    featuresEn: [
      "Up to 100 guests seated",
      "Up to 180 guests standing",
      "Complete exclusivity",
      "Catering by arrangement",
    ],
  },
];

interface EventPricingCardsProps {
  onInquiry?: (packageId: string) => void;
}

const EventPricingCards = ({ onInquiry }: EventPricingCardsProps) => {
  const { language } = useLanguage();

  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-serif font-medium mb-4">
            {language === 'de' ? "Unsere Event-Pakete" : "Our Event Packages"}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {language === 'de'
              ? "Wählen Sie das perfekte Paket für Ihren besonderen Anlass"
              : "Choose the perfect package for your special occasion"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-stretch">
          {pricingPackages.map((pkg) => {
            const name = language === 'de' ? pkg.name : pkg.nameEn;
            const description = language === 'de' ? pkg.description : pkg.descriptionEn;
            const features = language === 'de' ? pkg.features : pkg.featuresEn;
            const price = language === 'de' ? pkg.price : pkg.priceEn;
            const priceUnit = language === 'de' ? pkg.priceUnit : pkg.priceUnitEn;

            return (
              <Card 
                key={pkg.id} 
                className={cn(
                  "relative flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl",
                  pkg.featured && "ring-2 ring-primary md:scale-105 shadow-xl z-10"
                )}
              >
                {/* Featured Badge */}
                {pkg.featured && (
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
                    src={pkg.image}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                <CardHeader className="text-center pt-6 pb-2">
                  <h3 className="text-xl md:text-2xl font-serif font-medium">{name}</h3>
                  
                  {/* Price Display */}
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-primary">€{price}</span>
                    <span className="text-sm text-muted-foreground ml-1">{priceUnit}</span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-2">{description}</p>
                </CardHeader>

                <CardContent className="flex-1 pt-4">
                  <ul className="space-y-3">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-6 pb-6">
                  <Button 
                    onClick={() => onInquiry?.(pkg.id)}
                    className={cn(
                      "w-full gap-2",
                      pkg.featured ? "bg-primary hover:bg-primary/90" : ""
                    )}
                    variant={pkg.featured ? "default" : "outline"}
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
      </div>
    </section>
  );
};

export default EventPricingCards;
