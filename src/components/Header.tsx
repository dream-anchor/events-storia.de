import { Phone, Mail, Instagram, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const Header = () => {
  const { user } = useCustomerAuth();
  const { language } = useLanguage();

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-serif text-[1.55rem] md:text-[1.95rem] font-bold hover:opacity-80 transition-opacity">
            STORIA
          </Link>
          <div className="flex items-center gap-2 md:gap-6 text-base text-foreground/80 font-medium">
            <a 
              href="tel:+498951519696" 
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
            >
              <Phone className="h-5 w-5" />
              <span className="hidden sm:inline">+49 89 51519696</span>
            </a>
            <a 
              href="mailto:info@ristorantestoria.de" 
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
            >
              <Mail className="h-5 w-5" />
              <span className="hidden sm:inline">info@ristorantestoria.de</span>
            </a>
            <a 
              href="https://www.instagram.com/ristorante_storia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <Link 
              to={user ? "/konto" : "/login"}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
              title={user 
                ? (language === 'de' ? 'Mein Konto' : 'My Account')
                : (language === 'de' ? 'Anmelden' : 'Login')
              }
            >
              <User className="h-5 w-5" />
              <span className="hidden lg:inline">
                {user 
                  ? (language === 'de' ? 'Mein Konto' : 'My Account')
                  : (language === 'de' ? 'Anmelden' : 'Login')
                }
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
