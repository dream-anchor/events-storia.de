import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CartProvider } from "@/contexts/CartContext";
import { PriceDisplayProvider } from "@/contexts/PriceDisplayContext";
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
import AGBCatering from "./pages/AGBCatering";
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
import StickyCartPanel from "./components/cart/StickyCartPanel";
import Checkout from "./pages/Checkout";
import CustomerAuth from "./pages/CustomerAuth";
import CustomerProfile from "./pages/CustomerProfile";
import OrderSuccess from "./pages/OrderSuccess";
import PasswordReset from "./pages/PasswordReset";

// Catering Pages
import BuffetFingerfood from "./pages/catering/BuffetFingerfood";
import BuffetPlatten from "./pages/catering/BuffetPlatten";
import BuffetAuflauf from "./pages/catering/BuffetAuflauf";
import PizzeNapoletane from "./pages/catering/PizzeNapoletane";
import Desserts from "./pages/catering/Desserts";
import EventsImStoria from "./pages/catering/EventsImStoria";

const queryClient = new QueryClient();

// App component with all providers and contexts
const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <PriceDisplayProvider>
          <CookieConsentProvider>
            <CartProvider>
              <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <FloatingActions />
              <CartButton />
              <StickyCartPanel />
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
                <Route path="/catering/desserts" element={<Desserts />} />
                <Route path="/events" element={<EventsImStoria />} />
                {/* Redirects for old URLs */}
                <Route path="/catering/flying-buffet" element={<EventsImStoria />} />
                <Route path="/catering/festmenus" element={<EventsImStoria />} />
                
                {/* Checkout */}
                <Route path="/checkout" element={<Checkout />} />
                
                {/* Customer Account */}
                <Route path="/login" element={<CustomerAuth />} />
                <Route path="/konto" element={<CustomerProfile />} />
                <Route path="/konto/passwort-reset" element={<PasswordReset />} />
                <Route path="/konto/bestellung-erfolgreich" element={<OrderSuccess />} />
                
                {/* Admin */}
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                
                {/* Legal Pages */}
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/cookie-richtlinie" element={<CookieRichtlinie />} />
                <Route path="/agb-restaurant" element={<AGBRestaurant />} />
                <Route path="/agb-gutscheine" element={<AGBGutscheine />} />
                <Route path="/agb-catering" element={<AGBCatering />} />
                <Route path="/widerrufsbelehrung" element={<Widerrufsbelehrung />} />
                <Route path="/zahlungsinformationen" element={<Zahlungsinformationen />} />
                <Route path="/lebensmittelhinweise" element={<Lebensmittelhinweise />} />
                <Route path="/haftungsausschluss" element={<Haftungsausschluss />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </CartProvider>
          </CookieConsentProvider>
        </PriceDisplayProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
