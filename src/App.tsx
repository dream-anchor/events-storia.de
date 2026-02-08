import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CartProvider } from "@/contexts/CartContext";
import { PriceDisplayProvider } from "@/contexts/PriceDisplayContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import Index from "./pages/Index";
import Kontakt from "./pages/Kontakt";
import NotFound from "./pages/NotFound";
import { AdminAuthGuard } from "./components/admin/AdminAuthGuard";
import FloatingActions from "./components/FloatingActions";
import CookieBanner from "./components/CookieBanner";
import CookieSettingsButton from "./components/CookieSettingsButton";
import ScrollToTop from "./components/ScrollToTop";
import CartButton from "./components/cart/CartButton";
import CartSheet from "./components/cart/CartSheet";
import { usePrerenderReady } from "./hooks/usePrerenderReady";
import StickyCartPanel from "./components/cart/StickyCartPanel";

// Lazy-loaded routes (Code Splitting)
const PublicOffer = lazy(() => import("./pages/PublicOffer"));
const RefineAdminApp = lazy(() => import("./pages/RefineAdmin").then(m => ({ default: m.RefineAdminApp })));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CustomerAuth = lazy(() => import("./pages/CustomerAuth"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const FAQ = lazy(() => import("./pages/FAQ"));

// Legal Pages (lazy)
const Impressum = lazy(() => import("./pages/Impressum"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const CookieRichtlinie = lazy(() => import("./pages/CookieRichtlinie"));
const AGBRestaurant = lazy(() => import("./pages/AGBRestaurant"));
const AGBGutscheine = lazy(() => import("./pages/AGBGutscheine"));
const AGBCatering = lazy(() => import("./pages/AGBCatering"));
const Widerrufsbelehrung = lazy(() => import("./pages/Widerrufsbelehrung"));
const Zahlungsinformationen = lazy(() => import("./pages/Zahlungsinformationen"));
const Lebensmittelhinweise = lazy(() => import("./pages/Lebensmittelhinweise"));
const Haftungsausschluss = lazy(() => import("./pages/Haftungsausschluss"));

/** Renders frontend-only global components (cart, cookie banner, etc.) only on non-admin routes */
const FrontendGlobals = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;
  return (
    <>
      <FloatingActions />
      <CartButton />
      <StickyCartPanel />
      <CartSheet />
      <CookieBanner />
      <CookieSettingsButton />
    </>
  );
};

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
  // SSG: Signal to prerenderer that the page is ready for capture
  usePrerenderReady();

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <PriceDisplayProvider>
          <CookieConsentProvider>
            <CustomerAuthProvider>
              <CartProvider>
              <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <FrontendGlobals />
              <Suspense fallback={<div className="min-h-screen" />}>
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
                
                {/* Public Offer Page (link shared with customers) */}
                <Route path="/offer/:id" element={<PublicOffer />} />

                {/* Admin - Login route first, then protected routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/*" element={
                  <AdminAuthGuard>
                    <RefineAdminApp />
                  </AdminAuthGuard>
                } />
                
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
                <Route path="/faq-catering-muenchen" element={<FAQ />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
              </CartProvider>
            </CustomerAuthProvider>
          </CookieConsentProvider>
        </PriceDisplayProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
