import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const CheckoutHeader = () => {
  const { language } = useLanguage();

  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Back to cart link */}
          <Link 
            to="/catering/buffet-fingerfood" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === 'de' ? 'Zurück zum Menü' : 'Back to menu'}
            </span>
          </Link>
          
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
