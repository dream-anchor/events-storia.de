import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PriceDisplayContextType {
  showGross: boolean;
  setShowGross: (value: boolean) => void;
  formatPrice: (grossPrice: number, vatRate?: number) => string;
}

const PriceDisplayContext = createContext<PriceDisplayContextType | undefined>(undefined);

export const PriceDisplayProvider = ({ children }: { children: ReactNode }) => {
  const [showGross, setShowGross] = useState<boolean>(() => {
    const stored = localStorage.getItem('priceDisplay');
    return stored !== 'net'; // Default to gross (Brutto)
  });

  useEffect(() => {
    localStorage.setItem('priceDisplay', showGross ? 'gross' : 'net');
  }, [showGross]);

  // Format price based on display preference
  const formatPrice = (grossPrice: number, vatRate: number = 0.07): string => {
    const displayPrice = showGross ? grossPrice : grossPrice / (1 + vatRate);
    return displayPrice.toFixed(2).replace('.', ',') + ' €';
  };

  return (
    <PriceDisplayContext.Provider value={{ showGross, setShowGross, formatPrice }}>
      {children}
    </PriceDisplayContext.Provider>
  );
};

export const usePriceDisplay = () => {
  const context = useContext(PriceDisplayContext);
  if (!context) {
    throw new Error('usePriceDisplay must be used within a PriceDisplayProvider');
  }
  return context;
};
