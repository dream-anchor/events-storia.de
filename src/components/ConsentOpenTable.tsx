import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface ConsentOpenTableProps {
  src: string;
  title?: string;
  className?: string;
  height?: string | number;
  style?: React.CSSProperties;
}

const ConsentOpenTable = ({ src, title = "OpenTable Reservierung", className = "", height = 1100, style }: ConsentOpenTableProps) => {
  const { hasConsent, openSettings, savePreferences, consent } = useCookieConsent();
  const { t } = useLanguage();

  const handleEnableExternal = () => {
    savePreferences({
      statistics: consent?.statistics ?? false,
      marketing: consent?.marketing ?? false,
      external: true,
    });
  };

  if (!hasConsent("external")) {
    return (
      <div 
        className={`bg-secondary/50 border border-border rounded-lg flex flex-col items-center justify-center p-8 ${className}`}
        style={{ height: typeof height === 'number' ? `${height}px` : height, ...style }}
      >
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">{t.cookies.openTableBlocked}</h3>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
          {t.cookies.openTableBlockedDesc}
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button onClick={handleEnableExternal} variant="default">
            {t.cookies.enableOpenTable}
          </Button>
          <Button onClick={openSettings} variant="outline">
            {t.cookies.settings}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-6">
          {t.cookies.alternativeBooking}
        </p>
        <a href="tel:+498951519696" className="text-primary hover:underline font-medium mt-1">
          +49 89 51519696
        </a>
      </div>
    );
  }

  return (
    <iframe 
      src={src}
      className={`w-full border-0 ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height, ...style }}
      title={title}
      allow="geolocation"
    />
  );
};

export default ConsentOpenTable;
