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

    const w = window as typeof window & { clarity?: { (...args: unknown[]): void; q?: unknown[] } };
    w.clarity =
      w.clarity ||
      function (...args: unknown[]) {
        (w.clarity!.q = w.clarity!.q || []).push(args);
      };
    const script = document.createElement("script");
    script.id = "microsoft-clarity-script";
    script.async = true;
    script.src = "https://www.clarity.ms/tag/" + CLARITY_PROJECT_ID;
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode?.insertBefore(script, firstScript);
  }, [hasStatisticsConsent]);

  return null;
};

export default MicrosoftClarity;
