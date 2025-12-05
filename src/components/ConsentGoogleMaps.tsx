import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

interface ConsentGoogleMapsProps {
  src: string;
  title?: string;
  className?: string;
  height?: string | number;
}

const ConsentGoogleMaps = ({ src, title = "Google Maps", className = "", height = 400 }: ConsentGoogleMapsProps) => {
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
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">{t.cookies.mapsBlocked}</h3>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
          {t.cookies.mapsBlockedDesc}
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button onClick={handleEnableExternal} variant="default">
            {t.cookies.enableMaps}
          </Button>
          <Button onClick={openSettings} variant="outline">
            {t.cookies.settings}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={src}
      width="100%"
      height={height}
      style={{ border: 0 }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title={title}
      className={className}
    />
  );
};

export default ConsentGoogleMaps;
