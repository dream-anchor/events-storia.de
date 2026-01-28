import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Check } from "lucide-react";
import type { EventLocation } from "@/hooks/useEventPackages";

interface EventLocationCardProps {
  location: EventLocation;
}

const EventLocationCard = ({ location }: EventLocationCardProps) => {
  const { language } = useLanguage();

  const name = language === 'de' ? location.name : (location.name_en || location.name);
  const description = language === 'de' ? location.description : (location.description_en || location.description);
  const features = location.features || [];

  return (
    <Card className="h-full hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-medium">{name}</h3>
          <MapPin className="h-5 w-5 text-primary shrink-0" />
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Capacity Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {location.capacity_seated && (
            <Badge variant="secondary" className="gap-1.5">
              <Users className="h-3 w-3" />
              {location.capacity_seated} {language === 'de' ? 'sitzend' : 'seated'}
            </Badge>
          )}
          {location.capacity_standing && (
            <Badge variant="outline" className="gap-1.5">
              <Users className="h-3 w-3" />
              {location.capacity_standing} {language === 'de' ? 'stehend' : 'standing'}
            </Badge>
          )}
        </div>

        {/* Features */}
        {features.length > 0 && (
          <ul className="space-y-1.5">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default EventLocationCard;
