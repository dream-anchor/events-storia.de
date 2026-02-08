import { Phone, Mail, Instagram, User } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LocalizedLink } from "@/components/LocalizedLink";

const Header = () => {
  const { user } = useCustomerAuth();
  const { language } = useLanguage();

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <LocalizedLink to="home" className="font-serif text-[1.55rem] md:text-[1.95rem] font-bold hover:opacity-80 transition-opacity">
            STORIA
          </LocalizedLink>
          <div className="flex items-center gap-2 md:gap-6 text-base text-foreground/80 font-medium">
            <a 
              href="tel:+498951519696" 
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
            >
              <Phone className="h-5 w-5" />
              <span className="hidden sm:inline">+49 89 51519696</span>
            </a>
            <a 
              href="mailto:info@events-storia.de" 
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
            >
              <Mail className="h-5 w-5" />
              <span className="hidden sm:inline">info@events-storia.de</span>
            </a>
            <a 
              href="https://www.instagram.com/ristorante_storia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] gap-2 hover:text-foreground transition-colors touch-manipulation"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <LocalizedLink
              to={user ? "account" : "login"}
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
            </LocalizedLink>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
