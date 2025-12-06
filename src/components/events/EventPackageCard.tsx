import { Check, Star } from "lucide-react";
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

const EventPackageCard = ({ pkg, onSelect }: EventPackageCardProps) => {
  const { language } = useLanguage();
  
  const name = language === 'de' ? pkg.name : pkg.name_en;
  const description = language === 'de' ? pkg.description : pkg.description_en;
  const features = language === 'de' ? pkg.features : pkg.features_en;
  const price = language === 'de' ? pkg.price : pkg.price_en;

  return (
    <div 
      className={`relative bg-card border rounded-xl p-6 md:p-8 transition-all duration-300 hover:shadow-lg ${
        pkg.isRecommended 
          ? 'border-primary ring-2 ring-primary/20 scale-[1.02]' 
          : 'border-border/50 hover:border-primary/30'
      }`}
    >
      {pkg.isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
            <Star className="h-3 w-3 fill-current" />
            {language === 'de' ? 'Empfohlen' : 'Recommended'}
          </span>
        </div>
      )}
      
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
      
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
      
      <Button 
        onClick={() => onSelect(pkg.id)}
        variant={pkg.isRecommended ? "default" : "outline"}
        className="w-full"
      >
        {language === 'de' ? 'Anfrage starten' : 'Start Inquiry'}
      </Button>
    </div>
  );
};

export default EventPackageCard;
