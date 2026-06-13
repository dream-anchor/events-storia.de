import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface PrivacyModeContextType {
  /** When true, sensitive values (money, customer data) are blurred globally. */
  privacyMode: boolean;
  setPrivacyMode: (on: boolean) => void;
  togglePrivacyMode: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextType>({
  privacyMode: false,
  setPrivacyMode: () => {},
  togglePrivacyMode: () => {},
});

const STORAGE_KEY = "maestro_privacy_mode";

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const setPrivacyMode = useCallback((on: boolean) => {
    setPrivacyModeState(on);
    try {
      localStorage.setItem(STORAGE_KEY, String(on));
    } catch {}
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Drive global CSS via <body data-privacy="on|off">
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.privacy = privacyMode ? "on" : "off";
    return () => {
      delete document.body.dataset.privacy;
    };
  }, [privacyMode]);

  // Keyboard shortcut: Cmd/Ctrl + Shift + P
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePrivacyMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePrivacyMode]);

  return (
    <PrivacyModeContext.Provider value={{ privacyMode, setPrivacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}