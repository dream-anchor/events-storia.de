import { useState } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X, Cookie, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";

const CookieBanner = () => {
  const { showBanner, showSettings, acceptAll, rejectAll, savePreferences, closeSettings, openSettings } = useCookieConsent();
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState({
    statistics: false,
    marketing: false,
    external: false,
  });
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  if (!showBanner && !showSettings) return null;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const categories = [
    {
      id: "necessary",
      name: t.cookies.necessary,
      description: t.cookies.necessaryDesc,
      required: true,
    },
    {
      id: "statistics",
      name: t.cookies.statistics,
      description: t.cookies.statisticsDesc,
      required: false,
    },
    {
      id: "marketing",
      name: t.cookies.marketing,
      description: t.cookies.marketingDesc,
      required: false,
    },
    {
      id: "external",
      name: t.cookies.external,
      description: t.cookies.externalDesc,
      required: false,
    },
  ];

  // Settings Modal
  if (showSettings) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-card border border-border rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">{t.cookies.settingsTitle}</h2>
            <button onClick={closeSettings} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-secondary/30 cursor-pointer"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{category.name}</span>
                    {category.required && (
                      <span className="text-xs text-muted-foreground">({t.cookies.required})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={category.required || preferences[category.id as keyof typeof preferences]}
                      disabled={category.required}
                      onCheckedChange={(checked) => {
                        if (!category.required) {
                          setPreferences(prev => ({ ...prev, [category.id]: checked }));
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {expandedCategories.includes(category.id) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                {expandedCategories.includes(category.id) && (
                  <div className="p-3 text-sm text-muted-foreground bg-background">
                    {category.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-2">
            <Button onClick={rejectAll} variant="outline" className="flex-1">
              {t.cookies.rejectAll}
            </Button>
            <Button onClick={handleSavePreferences} variant="outline" className="flex-1">
              {t.cookies.saveSelection}
            </Button>
            <Button onClick={acceptAll} className="flex-1">
              {t.cookies.acceptAll}
            </Button>
          </div>

          <div className="px-4 pb-4 text-center">
            <Link to="/cookie-richtlinie" className="text-xs text-muted-foreground hover:text-foreground underline">
              {t.cookies.moreInfo}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Banner
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-lg shadow-2xl">
        <div className="p-4 md:p-6">
          <div className="flex items-start gap-3 mb-4">
            <Cookie className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold mb-2">{t.cookies.title}</h2>
              <p className="text-sm text-muted-foreground">
                {t.cookies.bannerText}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={rejectAll} variant="outline" className="flex-1">
              {t.cookies.rejectAll}
            </Button>
            <Button onClick={openSettings} variant="outline" className="flex-1">
              {t.cookies.settings}
            </Button>
            <Button onClick={acceptAll} className="flex-1">
              {t.cookies.acceptAll}
            </Button>
          </div>

          <div className="mt-3 text-center">
            <Link to="/datenschutz" className="text-xs text-muted-foreground hover:text-foreground underline mr-3">
              {t.footer.privacy}
            </Link>
            <Link to="/cookie-richtlinie" className="text-xs text-muted-foreground hover:text-foreground underline">
              {t.cookies.moreInfo}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
