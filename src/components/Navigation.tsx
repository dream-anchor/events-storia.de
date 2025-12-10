import { Link, useLocation } from "react-router-dom";
import { Menu, ChevronDown, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface NavChild {
  label: string;
  path: string;
  description?: string;
}

interface NavItem {
  label: string;
  path?: string;
  children?: NavChild[];
  icon?: React.ReactNode;
}

const Navigation = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const { language } = useLanguage();
  const { showGross, setShowGross } = usePriceDisplay();

  // Brutto/Netto Toggle Component
  const PriceToggle = () => (
    <div className="flex items-center gap-1 text-xs">
      <button
        onClick={() => setShowGross(true)}
        className={`px-2 py-1 rounded transition-colors ${
          showGross 
            ? 'bg-primary-foreground/20 font-medium' 
            : 'hover:bg-primary-foreground/10'
        }`}
      >
        Brutto
      </button>
      <span className="text-primary-foreground/40">|</span>
      <button
        onClick={() => setShowGross(false)}
        className={`px-2 py-1 rounded transition-colors ${
          !showGross 
            ? 'bg-primary-foreground/20 font-medium' 
            : 'hover:bg-primary-foreground/10'
        }`}
      >
        Netto
      </button>
    </div>
  );

  // Shop-Kategorie: Bestellbare Produkte
  const shopChildren: NavChild[] = language === 'de' ? [
    { label: "FINGERFOOD", path: "/catering/buffet-fingerfood", description: "Häppchen & Snacks" },
    { label: "PLATTEN & SHARING", path: "/catering/buffet-platten", description: "Kalte Buffet-Platten" },
    { label: "WARME GERICHTE", path: "/catering/buffet-auflauf", description: "Aufläufe & Schmorgerichte" },
    { label: "PIZZA NAPOLETANA", path: "/catering/pizze-napoletane", description: "Authentisch aus Neapel" },
    { label: "DESSERTS", path: "/catering/desserts", description: "Süße Verführungen" },
  ] : [
    { label: "FINGER FOOD", path: "/catering/buffet-fingerfood", description: "Bites & Snacks" },
    { label: "PLATTERS & SHARING", path: "/catering/buffet-platten", description: "Cold Buffet Platters" },
    { label: "HOT DISHES", path: "/catering/buffet-auflauf", description: "Casseroles & Braised Dishes" },
    { label: "PIZZA NAPOLETANA", path: "/catering/pizze-napoletane", description: "Authentic from Naples" },
    { label: "DESSERTS", path: "/catering/desserts", description: "Sweet Temptations" },
  ];

  // Events-Kategorie: Direkter Link zur Events-Seite
  const eventsPath = "/events";

  const navItems: NavItem[] = [
    { 
      label: language === 'de' ? "STARTSEITE" : "HOME", 
      path: "/" 
    },
    {
      label: language === 'de' ? "CATERING & LIEFERSERVICE" : "CATERING & DELIVERY",
      children: shopChildren,
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    {
      label: language === 'de' ? "EVENTS IM STORIA" : "EVENTS AT STORIA",
      path: eventsPath,
      icon: <Sparkles className="h-4 w-4" />,
    },
    { label: language === 'de' ? "KONTAKT" : "CONTACT", path: "/kontakt" },
  ];

  const toggleMobileMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (item: NavItem) => {
    if (item.path) return location.pathname === item.path;
    if (item.children) {
      return item.children.some((child) => location.pathname === child.path);
    }
    return false;
  };

  return (
    <nav className="bg-primary text-primary-foreground sticky top-0 z-50">
      <div className="container mx-auto px-4">
        {/* Mobile Navigation */}
        <div className="flex lg:hidden items-center justify-between py-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[300px] bg-primary text-primary-foreground border-r-accent"
            >
              <div className="flex flex-col gap-1 mt-8">
                {navItems.map((item) =>
                  item.children ? (
                    <Collapsible
                      key={item.label}
                      open={openMenus.includes(item.label)}
                      onOpenChange={() => toggleMobileMenu(item.label)}
                    >
                      <CollapsibleTrigger
                        className={`flex items-center justify-between w-full px-4 py-3 text-sm font-medium tracking-wider rounded-lg transition-all duration-300 ${
                          isActive(item)
                            ? "bg-primary-foreground/15 text-primary-foreground"
                            : "hover:bg-primary-foreground/10"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {item.icon}
                          {item.label}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 ${
                            openMenus.includes(item.label) ? "rotate-180" : ""
                          }`}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                        <div className="pl-4 py-2 space-y-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => setIsOpen(false)}
                              className={`block px-4 py-3 rounded-lg transition-all duration-300 ${
                                location.pathname === child.path
                                  ? "bg-primary-foreground/15"
                                  : "hover:bg-primary-foreground/10"
                              }`}
                            >
                              <span className="text-sm font-medium tracking-wider block">{child.label}</span>
                              {child.description && (
                                <span className="text-xs text-primary-foreground/60 mt-0.5 block">{child.description}</span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <Link
                      key={item.path}
                      to={item.path!}
                      onClick={() => setIsOpen(false)}
                      className={`px-4 py-3 text-sm font-medium tracking-wider rounded-lg transition-all duration-300 ${
                        location.pathname === item.path
                          ? "bg-primary-foreground/15"
                          : "hover:bg-primary-foreground/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                )}
                {/* Price Toggle & Language Switcher im Mobile Menu */}
                <div className="mt-6 px-4 pt-4 border-t border-primary-foreground/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary-foreground/70">{language === 'de' ? 'Preisanzeige' : 'Price display'}</span>
                    <PriceToggle />
                  </div>
                  <LanguageSwitcher />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          {/* Language Switcher Mobile (außerhalb Sheet) */}
          <div className="flex items-center gap-2">
            <PriceToggle />
            <LanguageSwitcher />
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center justify-between">
          <div className="w-24" /> {/* Spacer für Balance */}
          <div className="flex items-center justify-center gap-1">
            {navItems.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setHoveredMenu(item.label)}
                  onMouseLeave={() => setHoveredMenu(null)}
                >
                  <button
                    className={`group flex items-center gap-2 whitespace-nowrap px-5 py-4 text-sm font-medium tracking-wider transition-all duration-300 relative ${
                      isActive(item) ? "text-accent-foreground" : ""
                    }`}
                  >
                    {item.icon}
                    <span className="relative">
                      {item.label}
                      <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-primary-foreground transform transition-transform duration-300 origin-left ${
                        isActive(item) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`} />
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${hoveredMenu === item.label ? "rotate-180" : ""}`} />
                  </button>
                  
                  {/* 2025 Mega-Menu Dropdown with Glassmorphism */}
                  <div 
                    className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-300 ${
                      hoveredMenu === item.label 
                        ? "opacity-100 translate-y-0 pointer-events-auto" 
                        : "opacity-0 -translate-y-2 pointer-events-none"
                    }`}
                  >
                    <div className="bg-primary/95 backdrop-blur-xl border border-primary-foreground/10 rounded-xl shadow-2xl min-w-[280px] overflow-hidden">
                      {/* Dropdown Header */}
                      <div className="px-5 py-3 border-b border-primary-foreground/10 bg-primary-foreground/5">
                        <span className="text-xs font-medium tracking-widest text-primary-foreground/60 uppercase">
                          {item.label.includes("CATERING") 
                            ? (language === 'de' ? "Online Bestellung" : "Online Order")
                            : (language === 'de' ? "Im Restaurant" : "At Restaurant")
                          }
                        </span>
                      </div>
                      {/* Dropdown Items */}
                      <div className="py-2">
                        {item.children.map((child, index) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`group/item flex flex-col px-5 py-3 transition-all duration-300 hover:bg-primary-foreground/10 ${
                              location.pathname === child.path ? "bg-primary-foreground/10" : ""
                            }`}
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <span className="text-sm font-medium tracking-wider group-hover/item:translate-x-1 transition-transform duration-300">
                              {child.label}
                            </span>
                            {child.description && (
                              <span className="text-xs text-primary-foreground/50 mt-0.5 group-hover/item:text-primary-foreground/70 transition-colors duration-300">
                                {child.description}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.path}
                  to={item.path!}
                  className={`group whitespace-nowrap px-5 py-4 text-sm font-medium tracking-wider transition-all duration-300 relative`}
                >
                  <span className="relative">
                    {item.label}
                    <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-primary-foreground transform transition-transform duration-300 origin-left ${
                      location.pathname === item.path ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`} />
                  </span>
                </Link>
              )
            )}
          </div>
          {/* Price Toggle & Language Switcher Desktop - rechts */}
          <div className="flex items-center gap-3">
            <PriceToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
