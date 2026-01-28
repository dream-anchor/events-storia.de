import { Wheat, Truck, Utensils, Sparkles, Info, LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ServiceItem {
  icon: LucideIcon;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
}

const defaultServices: ServiceItem[] = [
  {
    icon: Truck,
    title: "Lieferung & Abholung",
    title_en: "Delivery & Pickup",
    subtitle: "Kostenlos im nahen Umkreis",
    subtitle_en: "Free within nearby area"
  },
  {
    icon: Utensils,
    title: "Aufbau & Service",
    title_en: "Setup & Service",
    subtitle: "Optional buchbar",
    subtitle_en: "Optionally bookable"
  },
  {
    icon: Sparkles,
    title: "Reinigung",
    title_en: "Cleaning",
    subtitle: "Im Preis inklusive",
    subtitle_en: "Included in price"
  }
];

// Elegant highlight card for special notices (bread, etc.)
export const HighlightCard = ({
  icon: Icon = Wheat,
  title,
  title_en,
  description,
  description_en,
  className
}: {
  icon?: LucideIcon;
  title: string;
  title_en: string;
  description?: string;
  description_en?: string;
  className?: string;
}) => {
  const { language } = useLanguage();
  
  return (
    <div className={cn(
      "border-y border-border/60 py-6 my-8",
      className
    )}>
      <div className="flex flex-col items-center text-center max-w-xl mx-auto">
        <Icon className="h-6 w-6 text-primary/70 mb-3" strokeWidth={1.5} />
        <p className="font-serif text-xl font-medium text-foreground mb-1">
          {language === 'en' ? title_en : title}
        </p>
        {(description || description_en) && (
          <p className="text-base text-muted-foreground">
            {language === 'en' ? description_en : description}
          </p>
        )}
      </div>
    </div>
  );
};

// Services grid with icon cards
export const ServicesGrid = ({
  services = defaultServices,
  title,
  className
}: {
  services?: ServiceItem[];
  title?: string;
  className?: string;
}) => {
  const { language } = useLanguage();
  
  return (
    <div className={cn("max-w-3xl mx-auto", className)}>
      {title && (
        <h2 className="text-center font-serif text-lg font-medium text-foreground mb-6">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map((service, index) => {
          const Icon = service.icon;
          return (
            <div 
              key={index}
              className="flex flex-col items-center text-center p-5 rounded-xl bg-card border border-border/50 shadow-sm"
            >
              <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-primary/70" strokeWidth={1.5} />
              </div>
              <p className="font-medium text-base text-foreground">
                {language === 'en' ? service.title_en : service.title}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'en' ? service.subtitle_en : service.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Compact allergen info badge
export const AllergenInfo = ({
  allergens,
  className
}: {
  allergens: Record<string, { de: string; en: string }>;
  className?: string;
}) => {
  const { language } = useLanguage();
  
  return (
    <div className={cn("max-w-3xl mx-auto", className)}>
      <div className="flex items-start gap-3 py-4 border-t border-border/40">
        <Info className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {language === 'de' ? 'Allergenkennzeichnung' : 'Allergen Information'}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
            {Object.entries(allergens).map(([key, value]) => (
              <span key={key} className="whitespace-nowrap">
                <span className="font-mono text-muted-foreground">[{key}]</span>{" "}
                {language === 'de' ? value.de : value.en}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export with all variants
const ServiceInfoCard = {
  Highlight: HighlightCard,
  Services: ServicesGrid,
  Allergens: AllergenInfo
};

export default ServiceInfoCard;
