import { useEffect, useState } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Star, Settings } from "lucide-react";

const ConsentElfsightReviews = () => {
  const { hasConsent, openSettings, savePreferences } = useCookieConsent();
  const { language } = useLanguage();
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (hasConsent("external") && !scriptLoaded) {
      // Check if script already exists
      if (!document.querySelector('script[src*="elfsightcdn"]')) {
        const script = document.createElement('script');
        script.src = 'https://static.elfsight.com/platform/platform.js';
        script.async = true;
        script.onload = () => setScriptLoaded(true);
        document.body.appendChild(script);
      } else {
        setScriptLoaded(true);
      }
    }
  }, [hasConsent("external"), scriptLoaded]);

  const handleEnableExternal = () => {
    savePreferences({
      statistics: hasConsent("statistics"),
      marketing: hasConsent("marketing"),
      external: true,
    });
  };

  if (!hasConsent("external")) {
    return (
      <div className="bg-secondary/50 border border-border rounded-xl p-8 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Star className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl md:text-2xl font-serif font-medium mb-3">
          {language === 'de' ? 'Kundenbewertungen anzeigen' : 'Show Customer Reviews'}
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          {language === 'de'
            ? 'Zur Anzeige externer Bewertungen von Google, TripAdvisor und Facebook benötigen wir Ihre Zustimmung.'
            : 'To display external reviews from Google, TripAdvisor and Facebook, we need your consent.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleEnableExternal} className="gap-2">
            <Star className="h-4 w-4" />
            {language === 'de' ? 'Bewertungen aktivieren' : 'Enable Reviews'}
          </Button>
          <Button variant="outline" onClick={openSettings} className="gap-2">
            <Settings className="h-4 w-4" />
            {language === 'de' ? 'Cookie-Einstellungen' : 'Cookie Settings'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="elfsight-app-d46d0ee4-9f21-4791-abc0-18390130877c" 
      data-elfsight-app-lazy
    />
  );
};

export default ConsentElfsightReviews;
