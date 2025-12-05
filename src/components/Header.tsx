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
          <Link to="/" className="font-serif text-2xl md:text-3xl font-bold hover:opacity-80 transition-opacity">
            STORIA
          </Link>
          <div className="flex items-center gap-4 md:gap-6 text-base text-foreground/80 font-medium">
            <a href="tel:+498951519696" className="flex items-center gap-2 hover:text-foreground transition-colors">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">+49 89 51519696</span>
            </a>
            <a href="mailto:info@ristorantestoria.de" className="flex items-center gap-2 hover:text-foreground transition-colors">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">info@ristorantestoria.de</span>
            </a>
            <a 
              href="https://www.instagram.com/ristorante_storia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <Link 
              to={user ? "/konto" : "/login"}
              className="flex items-center gap-2 hover:text-foreground transition-colors"
              title={user 
                ? (language === 'de' ? 'Mein Konto' : 'My Account')
                : (language === 'de' ? 'Anmelden' : 'Login')
              }
            >
              <User className="h-4 w-4" />
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
