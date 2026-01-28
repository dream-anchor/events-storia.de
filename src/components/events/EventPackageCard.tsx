import { Check, Leaf, Fish, Beef, Wine, Coffee, CakeSlice, UtensilsCrossed } from "lucide-react";
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

// Helper to get icon for feature item
const getFeatureIcon = (item: string) => {
  const lower = item.toLowerCase();
  if (lower.includes('vegan')) return <Leaf className="h-4 w-4 text-green-600 shrink-0" />;
  if (lower.includes('vegetarisch') || lower.includes('gemüse')) return <Leaf className="h-4 w-4 text-green-500 shrink-0" />;
  if (lower.includes('fisch') || lower.includes('fish') || lower.includes('dorade') || lower.includes('lachs')) return <Fish className="h-4 w-4 text-blue-500 shrink-0" />;
  if (lower.includes('fleisch') || lower.includes('meat') || lower.includes('rind') || lower.includes('beef') || lower.includes('enten')) return <Beef className="h-4 w-4 text-red-500 shrink-0" />;
  if (lower.includes('wein') || lower.includes('wine') || lower.includes('cocktail') || lower.includes('aperitif')) return <Wine className="h-4 w-4 text-purple-500 shrink-0" />;
  if (lower.includes('kaffee') || lower.includes('coffee')) return <Coffee className="h-4 w-4 text-amber-700 shrink-0" />;
  if (lower.includes('dessert') || lower.includes('mousse') || lower.includes('panna') || lower.includes('tiramisu') || lower.includes('schokolade')) return <CakeSlice className="h-4 w-4 text-pink-500 shrink-0" />;
  if (lower.includes('gang') || lower.includes('course') || lower.includes('menü') || lower.includes('menu')) return <UtensilsCrossed className="h-4 w-4 text-orange-500 shrink-0" />;
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
            {getFeatureIcon(feature)}
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
