import { useEffect } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Google Analytics 4 — Consent-gated Pageview Tracking + Global Click Delegation
 *
 * GA4 (G-P7H48RC2W1) + Consent Mode v2 bereits in index.html konfiguriert.
 * Diese Komponente sendet SPA-Pageviews und trackt Klicks auf Tel/WhatsApp.
 */

const GA_MEASUREMENT_ID = "G-P7H48RC2W1";

const GoogleAnalytics = () => {
  const { hasConsent } = useCookieConsent();
  const location = useLocation();
  const { language } = useLanguage();
  const hasStatisticsConsent = hasConsent("statistics");

  // Global click delegation — Tel- und WhatsApp-Links sitewide
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const page = window.location.pathname;

      if (href.startsWith("tel:")) {
        trackEvent("phone_click", { source: "global", page });
      } else if (href.includes("wa.me")) {
        trackEvent("whatsapp_click", { source: "global", page });
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // SPA-Pageview bei Route-Wechsel (nur mit Consent)
  useEffect(() => {
    if (!hasStatisticsConsent) return;

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_location: window.location.href,
      language,
    });
  }, [hasStatisticsConsent, location.pathname, language]);

  return null;
};

export default GoogleAnalytics;
