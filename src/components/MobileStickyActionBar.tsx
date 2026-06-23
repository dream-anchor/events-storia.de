import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CalendarHeart, Phone, MessageCircle } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const PHONE_HREF = "tel:+498951519696";
const WHATSAPP_HREF =
  "https://wa.me/491636033912?text=Hallo%2C%20ich%20m%C3%B6chte%20gerne%20einen%20Tisch%20im%20STORIA%20reservieren.";

const EXCLUDED_PREFIXES = [
  "/admin",
  "/offer/",
  "/ihr-angebot/",
  "/your-offer/",
  "/restzahlung/",
  "/en/balance-payment/",
];

const EXCLUDED_EXACT = new Set([
  "/reservierung",
  "/en/reservation",
  "/checkout",
]);

/**
 * Globale, mobile-only Bottom-Action-Bar (Reservieren · Anrufen · WhatsApp).
 * Desktop: rendert nichts (FloatingActions übernimmt dort).
 * Tracking: schickt einen einzigen reservation_click / phone_click / whatsapp_click
 * pro Klick mit location:'mobile_sticky_bar'. Globalen WhatsApp/Tel-Listener via
 * stopPropagation ausblenden, um Doppelfeuer zu verhindern.
 */
const MobileStickyActionBar = () => {
  const isMobile = useIsMobile();
  const { language } = useLanguage();
  const location = useLocation();
  const isDE = language === "de";

  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);

  const shouldRender =
    isMobile &&
    !EXCLUDED_EXACT.has(location.pathname) &&
    !EXCLUDED_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Body-Klasse für globales Padding (verhindert Inhalts-Verdeckung & Layout-Sprung).
  useEffect(() => {
    if (!shouldRender) return;
    document.body.classList.add("has-mobile-action-bar");
    return () => {
      document.body.classList.remove("has-mobile-action-bar");
    };
  }, [shouldRender]);

  // Scroll: beim Runterscrollen ausblenden, beim Hochscrollen einblenden.
  useEffect(() => {
    if (!shouldRender) return;
    lastYRef.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastYRef.current;
      if (Math.abs(dy) < 10) return;
      if (y < 80) {
        setHidden(false);
      } else if (dy > 0) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastYRef.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [shouldRender]);

  if (!shouldRender) return null;

  const handleReservation = () => {
    trackEvent("reservation_click", { location: "mobile_sticky_bar" });
  };

  const handlePhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackEvent("phone_click", { location: "mobile_sticky_bar" });
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackEvent("whatsapp_click", { location: "mobile_sticky_bar" });
  };

  const cellBase =
    "flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 px-1 text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <nav
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-300 will-change-transform",
        hidden ? "translate-y-full" : "translate-y-0"
      )}
      role="navigation"
      aria-label={isDE ? "Schnellaktionen" : "Quick actions"}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        <LocalizedLink
          to="/reservierung"
          onClick={handleReservation}
          className={cn(cellBase, "bg-primary text-primary-foreground hover:bg-primary/90")}
          aria-label={isDE ? "Tisch reservieren" : "Reserve a table"}
        >
          <CalendarHeart className="h-5 w-5" aria-hidden="true" />
          <span>{isDE ? "Reservieren" : "Reserve"}</span>
        </LocalizedLink>

        <a
          href={PHONE_HREF}
          onClick={handlePhone}
          className={cn(cellBase, "text-foreground hover:bg-secondary/60")}
          aria-label={isDE ? "Anrufen" : "Call"}
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          <span>{isDE ? "Anrufen" : "Call"}</span>
        </a>

        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsApp}
          className={cn(cellBase, "text-foreground hover:bg-secondary/60")}
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <span>WhatsApp</span>
        </a>
      </div>
    </nav>
  );
};

export default MobileStickyActionBar;