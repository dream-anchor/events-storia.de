import { Cookie } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLanguage } from "@/contexts/LanguageContext";

const CookieSettingsButton = () => {
  const { consent, openSettings } = useCookieConsent();
  const { t } = useLanguage();
  const location = useLocation();

  // Hide on admin pages
  if (location.pathname.startsWith('/admin')) return null;
  
  // Only show if consent has been given (banner was dismissed)
  if (!consent) return null;

  return (
    <button
      onClick={openSettings}
      className="fixed bottom-4 left-4 z-50 bg-card border border-border rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
      aria-label={t.cookies.changeSettings}
      title={t.cookies.changeSettings}
    >
      <Cookie className="h-5 w-5 text-primary" />
    </button>
  );
};

export default CookieSettingsButton;
