import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const CheckoutHeader = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Go back to previous page, or fallback to homepage
  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Back to previous page */}
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === 'de' ? 'Zurück' : 'Back'}
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
