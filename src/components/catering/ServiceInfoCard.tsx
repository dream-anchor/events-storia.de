import { Wheat, Truck, Utensils, Sparkles, Info, LucideIcon, MapPin, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ServiceItem {
  icon: LucideIcon;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  key: 'delivery' | 'service' | 'cleaning';
}

const defaultServices: ServiceItem[] = [
  {
    icon: Truck,
    title: "Lieferung & Abholung",
    title_en: "Delivery & Pickup",
    subtitle: "Kostenlos im nahen Umkreis",
    subtitle_en: "Free within nearby area",
    key: 'delivery'
  },
  {
    icon: Utensils,
    title: "Aufbau & Service",
    title_en: "Setup & Service",
    subtitle: "Optional buchbar",
    subtitle_en: "Optionally bookable",
    key: 'service'
  },
  {
    icon: Sparkles,
    title: "Reinigung",
    title_en: "Cleaning",
    subtitle: "Im Preis inklusive",
    subtitle_en: "Included in price",
    key: 'cleaning'
  }
];

// Detailed popover content for each service
const ServicePopoverContent = ({ serviceKey, language }: { serviceKey: string; language: string }) => {
  if (serviceKey === 'delivery') {
    return language === 'de' ? (
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-semibold text-foreground mb-2">Lieferkosten nach Entfernung:</p>
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="font-medium text-green-800 dark:text-green-200">≤ 1 km: KOSTENLOS</p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">Mindestbestellwert: 50€</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">1–8 km (München)</p>
              <p className="text-muted-foreground mt-1">50€ netto pro Fahrt</p>
              <p className="text-xs text-muted-foreground">• Pizza: 1× Hinfahrt (50€)</p>
              <p className="text-xs text-muted-foreground">• Catering mit Equipment: Hin + Rückfahrt (100€)</p>
              <p className="text-xs text-muted-foreground mt-1">Mindestbestellwert: 150€</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">&gt; 8 km</p>
              <p className="text-muted-foreground mt-1">1,20€ netto pro km</p>
              <p className="text-xs text-muted-foreground">• Pizza: 1× Strecke</p>
              <p className="text-xs text-muted-foreground">• Catering mit Equipment: 2× Strecke</p>
              <p className="text-xs text-muted-foreground mt-1">Mindestbestellwert: 200€</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Alle Preise zzgl. 19% MwSt.</p>
        </div>
        <div className="border-t pt-3 space-y-3">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-medium">Wartezeit:</span> Bei Lieferzeit über 15 Min. vor Ort: 50€/Mann pro angefangene Stunde
            </p>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Abholung möglich</p>
              <p className="text-muted-foreground text-xs">Karlstr. 47a, 80333 München</p>
              <p className="text-xs text-green-600 dark:text-green-400">Kostenlos, kein Mindestbestellwert</p>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-semibold text-foreground mb-2">Delivery costs by distance:</p>
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="font-medium text-green-800 dark:text-green-200">≤ 1 km: FREE</p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">Minimum order: €50</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">1–8 km (Munich)</p>
              <p className="text-muted-foreground mt-1">€50 net per trip</p>
              <p className="text-xs text-muted-foreground">• Pizza: 1× one-way (€50)</p>
              <p className="text-xs text-muted-foreground">• Catering with equipment: round trip (€100)</p>
              <p className="text-xs text-muted-foreground mt-1">Minimum order: €150</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">&gt; 8 km</p>
              <p className="text-muted-foreground mt-1">€1.20 net per km</p>
              <p className="text-xs text-muted-foreground">• Pizza: 1× distance</p>
              <p className="text-xs text-muted-foreground">• Catering with equipment: 2× distance</p>
              <p className="text-xs text-muted-foreground mt-1">Minimum order: €200</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">All prices plus 19% VAT.</p>
        </div>
        <div className="border-t pt-3 space-y-3">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <span className="font-medium">Waiting time:</span> If delivery takes over 15 min on-site: €50/person per started hour
            </p>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Pickup available</p>
              <p className="text-muted-foreground text-xs">Karlstr. 47a, 80333 Munich</p>
              <p className="text-xs text-green-600 dark:text-green-400">Free, no minimum order</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (serviceKey === 'service') {
    return language === 'de' ? (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">Aufbau & Service</p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Professioneller Buffet-Aufbau</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Raumgestaltung & Dekoration</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Zusätzliches Equipment (Küche, Grill, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Service-Personal vor Ort</span>
          </li>
        </ul>
        <div className="bg-muted/50 rounded-lg p-3 mt-2">
          <p className="text-xs text-muted-foreground">Preis nach Vereinbarung – wir erstellen Ihnen ein individuelles Angebot.</p>
        </div>
        <div className="border-t pt-3">
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Jetzt anfragen</p>
              <p className="text-muted-foreground text-xs">Tel: 089 55 06 71 50</p>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">Setup & Service</p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Professional buffet setup</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Room styling & decoration</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Additional equipment (kitchen, grill, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Service staff on-site</span>
          </li>
        </ul>
        <div className="bg-muted/50 rounded-lg p-3 mt-2">
          <p className="text-xs text-muted-foreground">Price by arrangement – we'll create a custom quote for you.</p>
        </div>
        <div className="border-t pt-3">
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Get in touch</p>
              <p className="text-muted-foreground text-xs">Tel: +49 89 55 06 71 50</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (serviceKey === 'cleaning') {
    return language === 'de' ? (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">Reinigung inklusive</p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Leihgeschirr wird gereinigt zurückgenommen</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Keine Reinigungsgebühren</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Einfache Rückgabe bei Abholung</span>
          </li>
        </ul>
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800 mt-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-medium">Tipp:</span> Reste einfach entsorgen – Geschirr muss nicht gespült werden.
          </p>
        </div>
      </div>
    ) : (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-foreground">Cleaning included</p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Rental tableware returned clean</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>No cleaning fees</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Easy return on pickup</span>
          </li>
        </ul>
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800 mt-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-medium">Tip:</span> Just dispose of leftovers – no need to wash the dishes.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

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

// Services grid with icon cards and info popovers
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
            <Popover key={index}>
              <PopoverTrigger asChild>
                <button
                  className="flex flex-col items-center text-center p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group w-full"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-5 w-5 text-primary/70" strokeWidth={1.5} />
                  </div>
                  <p className="font-medium text-base text-foreground">
                    {language === 'en' ? service.title_en : service.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'en' ? service.subtitle_en : service.subtitle}
                  </p>
                  <p className="text-xs text-primary/60 mt-2 group-hover:text-primary transition-colors">
                    {language === 'de' ? 'Mehr erfahren →' : 'Learn more →'}
                  </p>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="center" sideOffset={8}>
                <ServicePopoverContent serviceKey={service.key} language={language} />
              </PopoverContent>
            </Popover>
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
