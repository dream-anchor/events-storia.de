import { Check, Leaf, Fish, Beef, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventPackage {
  id: string;
  name: string;
  name_en: string;
  price: string;
  price_en: string;
  description: string;
  description_en: string;
  features: string[];
  features_en: string[];
  isRecommended?: boolean;
  minGuests?: number;
}

interface EventPackageCardProps {
  pkg: EventPackage;
  onSelect: (id: string) => void;
}

// Dietary icons for food items
const DietaryIcons = ({ item }: { item: string }) => {
  const lower = item.toLowerCase();
  
  // Food items that have dietary options (Vegan, Vegetarisch, Fisch, Fleisch)
  const hasFoodOptions = ['vorspeisenplatte', 'hauptgang', 'fingerfood', 'pasta-station', 'course'].some(f => lower.includes(f));
  // Dessert only has Vegan and Vegetarisch
  const isDessert = lower.includes('dessert') || lower.includes('mousse') || lower.includes('panna');
  // Drinks/other items - no dietary icons
  const isDrink = ['wein', 'wine', 'cocktail', 'aperitif', 'kaffee', 'coffee'].some(d => lower.includes(d));
  
  if (isDrink) {
    return <Wine className="h-4 w-4 text-purple-500 shrink-0" />;
  }
  
  if (hasFoodOptions) {
    return (
      <div className="flex items-center gap-1 shrink-0" title="Vegan, Vegetarisch, Fisch, Fleisch">
        <Leaf className="h-3.5 w-3.5 text-green-600" />
        <Leaf className="h-3.5 w-3.5 text-green-500" />
        <Fish className="h-3.5 w-3.5 text-blue-500" />
        <Beef className="h-3.5 w-3.5 text-red-500" />
      </div>
    );
  }
  
  if (isDessert) {
    return (
      <div className="flex items-center gap-1 shrink-0" title="Vegan, Vegetarisch">
        <Leaf className="h-3.5 w-3.5 text-green-600" />
        <Leaf className="h-3.5 w-3.5 text-green-500" />
      </div>
    );
  }
  
  return <Check className="h-4 w-4 text-primary shrink-0" />;
};

const EventPackageCard = ({ pkg, onSelect }: EventPackageCardProps) => {
  const { language } = useLanguage();
  
  const name = language === 'de' ? pkg.name : pkg.name_en;
  const description = language === 'de' ? pkg.description : pkg.description_en;
  const features = language === 'de' ? pkg.features : pkg.features_en;
  const price = language === 'de' ? pkg.price : pkg.price_en;

  return (
    <div 
      className="relative bg-card border border-border/50 rounded-xl p-6 md:p-8 transition-all duration-300 hover:shadow-lg hover:border-primary/30 flex flex-col h-full"
    >
      
      <div className="text-center mb-6">
        <h3 className="font-serif text-xl md:text-2xl font-medium mb-2">{name}</h3>
        <p className="text-2xl md:text-3xl font-bold text-primary">{price}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        {pkg.minGuests && (
          <p className="text-xs text-muted-foreground mt-2">
            {language === 'de' ? `Ab ${pkg.minGuests} Personen` : `From ${pkg.minGuests} guests`}
          </p>
        )}
      </div>
      
      <ul className="space-y-3 mb-8 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 text-sm">
            <DietaryIcons item={feature} />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      
      <div className="mt-auto">
        <Button 
          onClick={() => onSelect(pkg.id)}
          variant="outline"
          className="w-full"
        >
          {language === 'de' ? 'Anfrage starten' : 'Start Inquiry'}
        </Button>
      </div>
    </div>
  );
};

export default EventPackageCard;
