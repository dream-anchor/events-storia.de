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
  description: string;
  descriptionEn: string;
  features: string[];
  featuresEn: string[];
  featured?: boolean;
}

const pricingPackages: PricingPackage[] = [
  {
    id: "essenz",
    image: packageEssenz,
    name: "Storia Essenz",
    nameEn: "Storia Essence",
    description: "Das Grundpaket für stilvolle Anlässe",
    descriptionEn: "The basic package for stylish occasions",
    features: [
      "3-Gänge-Menü aus unserer Küche",
      "Getränkepaket mit Wein & Wasser",
      "Persönlicher Ansprechpartner",
      "Flexible Raumgestaltung",
    ],
    featuresEn: [
      "3-course menu from our kitchen",
      "Drink package with wine & water",
      "Personal point of contact",
      "Flexible room arrangement",
    ],
  },
  {
    id: "premium",
    image: packagePremium,
    name: "Storia Premium",
    nameEn: "Storia Premium",
    description: "Unser meistgebuchtes Paket",
    descriptionEn: "Our most booked package",
    features: [
      "4-Gänge-Menü mit Premium-Zutaten",
      "Signature Cocktails & Aperitivo",
      "Exklusive Weinauswahl",
      "DJ-Pult & Musikanlage inklusive",
    ],
    featuresEn: [
      "4-course menu with premium ingredients",
      "Signature cocktails & aperitivo",
      "Exclusive wine selection",
      "DJ booth & sound system included",
    ],
    featured: true,
  },
  {
    id: "exklusiv",
    image: packageExklusiv,
    name: "Storia Exklusiv",
    nameEn: "Storia Exclusive",
    description: "Das Rundum-sorglos-Paket",
    descriptionEn: "The all-inclusive package",
    features: [
      "5-Gänge-Gala-Dinner",
      "Full Open Bar die ganze Nacht",
      "Komplette Location exklusiv",
      "Floristik & Dekoration inklusive",
    ],
    featuresEn: [
      "5-course gala dinner",
      "Full open bar all night",
      "Entire location exclusively yours",
      "Floristry & decoration included",
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
                  <h3 className="text-2xl font-serif font-medium">{name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
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
