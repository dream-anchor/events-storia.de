import { useEffect } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLocation } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Google Analytics 4 — Consent-gated Pageview Tracking + Global Click Delegation
 *
 * Architektur (wie ristorantestoria.de):
 * 1. index.html:           gtag('consent', 'default', {denied}) — sync, vor allem anderen
 * 2. CookieConsentContext:  gtag('consent', 'update', {granted}) — nach Nutzer-Entscheidung
 * 3. Diese Komponente:      gtag.js laden + config/Pageview — ERST nach Einwilligung Statistik,
 *                           nie auf /admin. Vorher wird keine Verbindung zu Google aufgebaut.
 * Außerdem Klick-Tracking für Tel/WhatsApp (nur mit Einwilligung).
 */

const GTAG_SCRIPT_SELECTOR = 'script[src*="googletagmanager.com/gtag/js"]';

const GA_MEASUREMENT_ID = "G-P7H48RC2W1";

const GoogleAnalytics = () => {
  const { hasConsent } = useCookieConsent();
  const location = useLocation();
  const { language } = useLanguage();
  const hasStatisticsConsent = hasConsent("statistics");

  // Global click delegation — Tel- und WhatsApp-Links sitewide (nur mit Consent)
  useEffect(() => {
    if (!hasStatisticsConsent) return;

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
  }, [hasStatisticsConsent]);

  // gtag.js erst nach Einwilligung laden; danach SPA-Pageview bei Route-Wechsel
  useEffect(() => {
    if (!hasStatisticsConsent) return;
    if (location.pathname.startsWith("/admin")) return; // Admin: kein gtag.js, kein Pageview
    if (typeof window.gtag !== "function") return;

    if (!document.querySelector(GTAG_SCRIPT_SELECTOR)) {
      const script = document.createElement("script");
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      script.async = true;
      document.head.appendChild(script);
      // dataLayer-Queue: gtag.js verarbeitet diese Einträge nach dem Laden
      window.gtag("js", new Date());
    }

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_location: window.location.href,
      language,
    });
  }, [hasStatisticsConsent, location.pathname, language]);

  return null;
};

export default GoogleAnalytics;
