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
const Kontakt = lazy(() => import("./pages/Kontakt"));

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

// Catering Pages (lazy)
const BuffetFingerfood = lazy(() => import("./pages/catering/BuffetFingerfood"));
const BuffetPlatten = lazy(() => import("./pages/catering/BuffetPlatten"));
const BuffetAuflauf = lazy(() => import("./pages/catering/BuffetAuflauf"));
const PizzeNapoletane = lazy(() => import("./pages/catering/PizzeNapoletane"));
const Desserts = lazy(() => import("./pages/catering/Desserts"));
const EventsImStoria = lazy(() => import("./pages/catering/EventsImStoria"));

// SEO Landing Pages (lazy)
const ItalienischesCateringMuenchen = lazy(() => import("./pages/seo/ItalienischesCateringMuenchen"));
const FirmenfeierCateringMuenchen = lazy(() => import("./pages/seo/FirmenfeierCateringMuenchen"));
const WeihnachtsfeierCateringMuenchen = lazy(() => import("./pages/seo/WeihnachtsfeierCateringMuenchen"));
const PizzaCateringMuenchen = lazy(() => import("./pages/seo/PizzaCateringMuenchen"));
const BueroCateringMuenchen = lazy(() => import("./pages/seo/BueroCateringMuenchen"));

const queryClient = new QueryClient();

// App component with all providers and contexts
const App = () => {
  // SSG: Signal to prerenderer that the page is ready for capture
  usePrerenderReady();

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PriceDisplayProvider>
        <CookieConsentProvider>
          <CustomerAuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <LanguageProvider>
                <CartProvider>
                  <ScrollToTop />
                  <FrontendGlobals />
                  <Suspense fallback={<div className="min-h-screen" />}>
                  <Routes>
                    {/* === German Routes (no prefix) === */}
                    <Route path="/" element={<Index />} />
                    <Route path="/kontakt" element={<Kontakt />} />

                    {/* Catering */}
                    <Route path="/catering/buffet-fingerfood" element={<BuffetFingerfood />} />
                    <Route path="/catering/buffet-platten" element={<BuffetPlatten />} />
                    <Route path="/catering/buffet-auflauf" element={<BuffetAuflauf />} />
                    <Route path="/catering/pizze-napoletane" element={<PizzeNapoletane />} />
                    <Route path="/catering/desserts" element={<Desserts />} />
                    <Route path="/events" element={<EventsImStoria />} />
                    {/* Redirects for old URLs */}
                    <Route path="/catering/flying-buffet" element={<EventsImStoria />} />
                    <Route path="/catering/festmenus" element={<EventsImStoria />} />

                    {/* Checkout & Account */}
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/login" element={<CustomerAuth />} />
                    <Route path="/konto" element={<CustomerProfile />} />
                    <Route path="/konto/passwort-reset" element={<PasswordReset />} />
                    <Route path="/konto/bestellung-erfolgreich" element={<OrderSuccess />} />

                    {/* Public Offer */}
                    <Route path="/offer/:id" element={<PublicOffer />} />

                    {/* Legal */}
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

                    {/* SEO Landing Pages DE */}
                    <Route path="/italienisches-catering-muenchen" element={<ItalienischesCateringMuenchen />} />
                    <Route path="/firmenfeier-catering-muenchen" element={<FirmenfeierCateringMuenchen />} />
                    <Route path="/weihnachtsfeier-catering-muenchen" element={<WeihnachtsfeierCateringMuenchen />} />
                    <Route path="/pizza-catering-muenchen" element={<PizzaCateringMuenchen />} />
                    <Route path="/buero-catering-muenchen" element={<BueroCateringMuenchen />} />

                    {/* === English Routes (/en/ prefix) === */}
                    <Route path="/en" element={<Index />} />
                    <Route path="/en/contact" element={<Kontakt />} />

                    {/* Catering EN */}
                    <Route path="/en/catering/finger-food-buffet" element={<BuffetFingerfood />} />
                    <Route path="/en/catering/platters-sharing" element={<BuffetPlatten />} />
                    <Route path="/en/catering/hot-dishes" element={<BuffetAuflauf />} />
                    <Route path="/en/catering/pizza-napoletana" element={<PizzeNapoletane />} />
                    <Route path="/en/catering/desserts" element={<Desserts />} />
                    <Route path="/en/events" element={<EventsImStoria />} />

                    {/* Checkout & Account EN */}
                    <Route path="/en/checkout" element={<Checkout />} />
                    <Route path="/en/login" element={<CustomerAuth />} />
                    <Route path="/en/account" element={<CustomerProfile />} />
                    <Route path="/en/account/password-reset" element={<PasswordReset />} />
                    <Route path="/en/account/order-success" element={<OrderSuccess />} />

                    {/* Public Offer EN */}
                    <Route path="/en/offer/:id" element={<PublicOffer />} />

                    {/* Legal EN */}
                    <Route path="/en/imprint" element={<Impressum />} />
                    <Route path="/en/privacy" element={<Datenschutz />} />
                    <Route path="/en/cookie-policy" element={<CookieRichtlinie />} />
                    <Route path="/en/restaurant-terms" element={<AGBRestaurant />} />
                    <Route path="/en/voucher-terms" element={<AGBGutscheine />} />
                    <Route path="/en/catering-terms" element={<AGBCatering />} />
                    <Route path="/en/cancellation-policy" element={<Widerrufsbelehrung />} />
                    <Route path="/en/payment-information" element={<Zahlungsinformationen />} />
                    <Route path="/en/food-information" element={<Lebensmittelhinweise />} />
                    <Route path="/en/disclaimer" element={<Haftungsausschluss />} />
                    <Route path="/en/catering-faq-munich" element={<FAQ />} />

                    {/* SEO Landing Pages EN */}
                    <Route path="/en/italian-catering-munich" element={<ItalienischesCateringMuenchen />} />
                    <Route path="/en/corporate-event-catering-munich" element={<FirmenfeierCateringMuenchen />} />
                    <Route path="/en/christmas-party-catering-munich" element={<WeihnachtsfeierCateringMuenchen />} />
                    <Route path="/en/pizza-catering-munich" element={<PizzaCateringMuenchen />} />
                    <Route path="/en/office-catering-munich" element={<BueroCateringMuenchen />} />

                    {/* === Admin (language-neutral) === */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin/*" element={
                      <AdminAuthGuard>
                        <RefineAdminApp />
                      </AdminAuthGuard>
                    } />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </Suspense>
                </CartProvider>
              </LanguageProvider>
            </BrowserRouter>
          </CustomerAuthProvider>
        </CookieConsentProvider>
      </PriceDisplayProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
