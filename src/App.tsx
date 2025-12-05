import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Kontakt from "./pages/Kontakt";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import CookieRichtlinie from "./pages/CookieRichtlinie";
import AGBRestaurant from "./pages/AGBRestaurant";
import AGBGutscheine from "./pages/AGBGutscheine";
import Widerrufsbelehrung from "./pages/Widerrufsbelehrung";
import Zahlungsinformationen from "./pages/Zahlungsinformationen";
import Lebensmittelhinweise from "./pages/Lebensmittelhinweise";
import Haftungsausschluss from "./pages/Haftungsausschluss";
import FloatingActions from "./components/FloatingActions";
import CookieBanner from "./components/CookieBanner";
import CookieSettingsButton from "./components/CookieSettingsButton";
import ScrollToTop from "./components/ScrollToTop";
import CartButton from "./components/cart/CartButton";
import CartSheet from "./components/cart/CartSheet";
import Checkout from "./pages/Checkout";

// Catering Pages
import BuffetFingerfood from "./pages/catering/BuffetFingerfood";
import BuffetPlatten from "./pages/catering/BuffetPlatten";
import BuffetAuflauf from "./pages/catering/BuffetAuflauf";
import PizzeNapoletane from "./pages/catering/PizzeNapoletane";
import FlyingBuffet from "./pages/catering/FlyingBuffet";
import Festmenus from "./pages/catering/Festmenus";

const queryClient = new QueryClient();

// App component with all providers and contexts
const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <CookieConsentProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <FloatingActions />
              <CartButton />
              <CartSheet />
              <CookieBanner />
              <CookieSettingsButton />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/kontakt" element={<Kontakt />} />
                
                {/* Catering Pages */}
                <Route path="/catering/buffet-fingerfood" element={<BuffetFingerfood />} />
                <Route path="/catering/buffet-platten" element={<BuffetPlatten />} />
                <Route path="/catering/buffet-auflauf" element={<BuffetAuflauf />} />
                <Route path="/catering/pizze-napoletane" element={<PizzeNapoletane />} />
                <Route path="/catering/flying-buffet" element={<FlyingBuffet />} />
                <Route path="/catering/festmenus" element={<Festmenus />} />
                
                {/* Checkout */}
                <Route path="/checkout" element={<Checkout />} />
                
                {/* Admin */}
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                
                {/* Legal Pages */}
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/cookie-richtlinie" element={<CookieRichtlinie />} />
                <Route path="/agb-restaurant" element={<AGBRestaurant />} />
                <Route path="/agb-gutscheine" element={<AGBGutscheine />} />
                <Route path="/widerrufsbelehrung" element={<Widerrufsbelehrung />} />
                <Route path="/zahlungsinformationen" element={<Zahlungsinformationen />} />
                <Route path="/lebensmittelhinweise" element={<Lebensmittelhinweise />} />
                <Route path="/haftungsausschluss" element={<Haftungsausschluss />} />
                
              <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </CookieConsentProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
