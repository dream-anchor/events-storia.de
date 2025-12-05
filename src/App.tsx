import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import Index from "./pages/Index";
import Reservierung from "./pages/Reservierung";
import Menu from "./pages/Menu";
import Mittagsmenu from "./pages/Mittagsmenu";
import Speisekarte from "./pages/Speisekarte";
import Getraenke from "./pages/Getraenke";
import BesondereAnlaesse from "./pages/BesondereAnlaesse";
import BesondererAnlass from "./pages/BesondererAnlass";
import Kontakt from "./pages/Kontakt";
import Catering from "./pages/Catering";
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
import UeberUns from "./pages/UeberUns";
import FloatingActions from "./components/FloatingActions";
import CookieBanner from "./components/CookieBanner";
import CookieSettingsButton from "./components/CookieSettingsButton";
import ScrollToTop from "./components/ScrollToTop";

// SEO Landingpages
import LunchMuenchen from "./pages/seo/LunchMuenchen";
import AperitivoMuenchen from "./pages/seo/AperitivoMuenchen";
import RomantischesDinner from "./pages/seo/RomantischesDinner";
import EventlocationMuenchen from "./pages/seo/EventlocationMuenchen";
import FirmenfeierMuenchen from "./pages/seo/FirmenfeierMuenchen";
import GeburtstagsfeierMuenchen from "./pages/seo/GeburtstagsfeierMuenchen";
import NeapolitanischePizza from "./pages/seo/NeapolitanischePizza";

const queryClient = new QueryClient();

// App component with all providers and contexts
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <CookieConsentProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <FloatingActions />
            <CookieBanner />
            <CookieSettingsButton />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/reservierung" element={<Reservierung />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/mittagsmenu" element={<Mittagsmenu />} />
              <Route path="/speisekarte" element={<Speisekarte />} />
              <Route path="/getraenke" element={<Getraenke />} />
              <Route path="/besondere-anlaesse" element={<BesondereAnlaesse />} />
              <Route path="/besondere-anlaesse/:slug" element={<BesondererAnlass />} />
              <Route path="/kontakt" element={<Kontakt />} />
              <Route path="/catering" element={<Catering />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/cookie-richtlinie" element={<CookieRichtlinie />} />
              <Route path="/agb-restaurant" element={<AGBRestaurant />} />
              <Route path="/agb-gutscheine" element={<AGBGutscheine />} />
              <Route path="/widerrufsbelehrung" element={<Widerrufsbelehrung />} />
              <Route path="/zahlungsinformationen" element={<Zahlungsinformationen />} />
              <Route path="/lebensmittelhinweise" element={<Lebensmittelhinweise />} />
              <Route path="/haftungsausschluss" element={<Haftungsausschluss />} />
              <Route path="/ueber-uns" element={<UeberUns />} />
              
              {/* SEO Landingpages - nicht im Hauptmenü verlinkt */}
              <Route path="/lunch-muenchen-maxvorstadt" element={<LunchMuenchen />} />
              <Route path="/aperitivo-muenchen" element={<AperitivoMuenchen />} />
              <Route path="/romantisches-dinner-muenchen" element={<RomantischesDinner />} />
              <Route path="/eventlocation-muenchen-maxvorstadt" element={<EventlocationMuenchen />} />
              <Route path="/firmenfeier-muenchen" element={<FirmenfeierMuenchen />} />
              <Route path="/geburtstagsfeier-muenchen" element={<GeburtstagsfeierMuenchen />} />
              <Route path="/neapolitanische-pizza-muenchen" element={<NeapolitanischePizza />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CookieConsentProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
