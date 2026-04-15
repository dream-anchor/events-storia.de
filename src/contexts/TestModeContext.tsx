import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface TestModeContextType {
  /** When true, test records are visible in all lists/dashboards */
  showTestData: boolean;
  /** Toggle test data visibility */
  setShowTestData: (show: boolean) => void;
}

const TestModeContext = createContext<TestModeContextType>({
  showTestData: false,
  setShowTestData: () => {},
});

const STORAGE_KEY = "maestro_show_test_data";

export function TestModeProvider({ children }: { children: ReactNode }) {
  const [showTestData, setShowTestDataState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const setShowTestData = useCallback((show: boolean) => {
    setShowTestDataState(show);
    try {
      localStorage.setItem(STORAGE_KEY, String(show));
    } catch {}
  }, []);

  return (
    <TestModeContext.Provider value={{ showTestData, setShowTestData }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  return useContext(TestModeContext);
}
