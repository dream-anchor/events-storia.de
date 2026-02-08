import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { de } from "@/translations/de";
import { en } from "@/translations/en";
import { getLanguageFromPath, getAlternatePath } from "@/config/routes";

type Language = "de" | "en";
type Translations = typeof de;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Detect language from current URL
  const [language, setLanguageState] = useState<Language>(() =>
    getLanguageFromPath(location.pathname)
  );

  // Sync language when URL changes (e.g. browser back/forward)
  useEffect(() => {
    // Skip admin routes — they are language-neutral
    if (location.pathname.startsWith('/admin')) return;

    const urlLang = getLanguageFromPath(location.pathname);
    if (urlLang !== language) {
      setLanguageState(urlLang);
    }
  }, [location.pathname]);

  // Switch language: navigates to the alternate-language URL
  const setLanguage = useCallback((newLang: Language) => {
    if (newLang === language) return;

    // Skip admin routes
    if (location.pathname.startsWith('/admin')) {
      setLanguageState(newLang);
      return;
    }

    const alternatePath = getAlternatePath(location.pathname, language);
    // Preserve query string and hash
    const suffix = location.search + location.hash;
    setLanguageState(newLang);
    navigate(alternatePath + suffix, { replace: true });
  }, [language, location.pathname, location.search, location.hash, navigate]);

  const translations = { de, en };
  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
