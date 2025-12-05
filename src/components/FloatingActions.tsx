import { useState, useEffect } from "react";
import { Phone, UtensilsCrossed, Copy, Check } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const FloatingActions = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Sichtbar wenn gescrollt > 100px
      const hasScrolled = scrollY > 100;
      
      // Am Footer wenn ganz unten (50px Puffer)
      const nearBottom = scrollY + windowHeight >= documentHeight - 50;
      
      setIsVisible(hasScrolled && !nearBottom);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText("+49 89 51519696");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Nicht auf Admin-Seiten anzeigen
  if (location.pathname.startsWith('/admin')) return null;

  if (!isVisible) return null;

  const buttonClasses = "bg-white hover:bg-gray-50 text-primary border-2 border-primary/20 rounded-2xl px-5 py-3 shadow-xl transition-all hover:scale-105 flex flex-col items-center gap-1";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 animate-fade-in">
      {/* Telefon Button */}
      {isMobile ? (
        <a
          href="tel:+498951519696"
          className={buttonClasses}
        >
          <Phone className="h-5 w-5" />
          <span className="text-sm font-semibold">{t.floatingActions.call}</span>
        </a>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <button className={buttonClasses}>
              <Phone className="h-5 w-5" />
              <span className="text-sm font-semibold">{t.floatingActions.call}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" className="w-auto p-3">
            <div className="flex items-center gap-3">
              <span className="font-medium whitespace-nowrap">+49 89 51519696</span>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
                className="h-8 px-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
      
      {/* Reservierung Button */}
      <Link
        to="/reservierung"
        className={buttonClasses}
      >
        <UtensilsCrossed className="h-5 w-5" />
        <span className="text-sm font-semibold">{t.floatingActions.reserve}</span>
      </Link>
    </div>
  );
};

export default FloatingActions;
