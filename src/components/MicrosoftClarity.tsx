import { useEffect } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

/**
 * Microsoft Clarity — nur laden, wenn Statistik-Consent erteilt wurde (DSGVO).
 */
const CLARITY_PROJECT_ID = "vfosqbett5";

const MicrosoftClarity = () => {
  const { hasConsent } = useCookieConsent();
  const hasStatisticsConsent = hasConsent("statistics");

  useEffect(() => {
    if (!hasStatisticsConsent) return;
    if (document.getElementById("microsoft-clarity-script")) return;

    (function (c: any, l: Document, a: string, r: string, i: string) {
      c[a] =
        c[a] ||
        function (...args: unknown[]) {
          (c[a].q = c[a].q || []).push(args);
        };
      const t = l.createElement(r) as HTMLScriptElement;
      t.id = "microsoft-clarity-script";
      t.async = true;
      t.src = "https://www.clarity.ms/tag/" + i;
      const y = l.getElementsByTagName(r)[0];
      y.parentNode?.insertBefore(t, y);
    })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
  }, [hasStatisticsConsent]);

  return null;
};

export default MicrosoftClarity;
