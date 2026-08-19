import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";

interface MaestroInquiryDetail {
  name?: string;
  [key: string]: unknown;
}

/**
 * Global bridge for externally hosted MAESTRO form widgets.
 * MAESTRO dispatches `MAESTRO_INQUIRY_SUBMITTED` on successful submit —
 * we fire the GA4 conversion and forward to the localized thank-you page.
 */
const MaestroInquiryBridge = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    const handleSubmitted = (event: Event) => {
      const detail = (event as CustomEvent<MaestroInquiryDetail>).detail ?? {};
      const name = typeof detail.name === "string" ? detail.name.trim() : "";

      trackEvent("generate_lead", {
        currency: "EUR",
        value: 1500,
        source: "maestro_widget",
      });

      const target = language === "en" ? "/en/thank-you" : "/danke";
      const query = name ? `?name=${encodeURIComponent(name)}` : "";
      navigate(`${target}${query}`);
    };

    window.addEventListener("MAESTRO_INQUIRY_SUBMITTED", handleSubmitted);
    return () => window.removeEventListener("MAESTRO_INQUIRY_SUBMITTED", handleSubmitted);
  }, [navigate, language]);

  return null;
};

export default MaestroInquiryBridge;
