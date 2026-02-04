import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

// Key for storing the checkout entry page
const CHECKOUT_ENTRY_PAGE_KEY = 'storia-checkout-entry-page';

const CheckoutHeader = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [entryPage, setEntryPage] = useState<string>('/');

  // On mount, store or retrieve the entry page
  useEffect(() => {
    const storedEntryPage = sessionStorage.getItem(CHECKOUT_ENTRY_PAGE_KEY);

    if (storedEntryPage) {
      // Already have an entry page stored - use it
      setEntryPage(storedEntryPage);
    } else {
      // First time entering checkout - store the referrer
      const referrer = document.referrer;
      let entryUrl = '/';

      if (referrer) {
        try {
          const url = new URL(referrer);
          // Only use referrer if it's from the same domain and not checkout/payment pages
          if (url.origin === window.location.origin &&
              !url.pathname.includes('/checkout') &&
              !url.pathname.includes('/payment')) {
            entryUrl = url.pathname;
          }
        } catch {
          // Invalid URL, use default
        }
      }

      sessionStorage.setItem(CHECKOUT_ENTRY_PAGE_KEY, entryUrl);
      setEntryPage(entryUrl);
    }
  }, []);

  // Navigate back to the entry page
  const handleBack = () => {
    navigate(entryPage);
  };

  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Back to entry page */}
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === 'de' ? 'Zurück zum Menü' : 'Back to menu'}
            </span>
          </button>
          
          {/* Centered Logo */}
          <Link 
            to="/" 
            className="font-serif text-2xl md:text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            STORIA
          </Link>
          
          {/* Spacer for centering */}
          <div className="w-[100px] hidden sm:block" />
        </div>
      </div>
    </header>
  );
};

export default CheckoutHeader;
