import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// VAT rates as of January 2026
export const VAT_RATES = {
  FOOD: 0.07,      // 7% for food
  DRINKS: 0.19,    // 19% for drinks
  DELIVERY: 0.19,  // 19% for delivery services
} as const;

// 70/30 split for packages including food + drinks (BMF simplified rule)
export const PACKAGE_SPLIT = {
  FOOD_PORTION: 0.70,    // 70% food
  DRINKS_PORTION: 0.30,  // 30% drinks
} as const;

export interface VatBreakdown {
  foodGross: number;
  foodNet: number;
  foodVat: number;
  drinksGross: number;
  drinksNet: number;
  drinksVat: number;
  totalGross: number;
  totalNet: number;
  totalVat: number;
}

interface PriceDisplayContextType {
  showGross: boolean;
  setShowGross: (value: boolean) => void;
  formatPrice: (grossPrice: number, vatRate?: number) => string;
  formatPriceValue: (grossPrice: number, vatRate?: number) => number;
  calculatePackageVat: (grossPrice: number) => VatBreakdown;
  calculateSimpleVat: (grossPrice: number, vatRate?: number) => { gross: number; net: number; vat: number };
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

  // Calculate VAT for packages with 70/30 split (food + drinks)
  const calculatePackageVat = (grossPrice: number): VatBreakdown => {
    // Split gross price into food and drinks portions
    const foodGross = grossPrice * PACKAGE_SPLIT.FOOD_PORTION;
    const drinksGross = grossPrice * PACKAGE_SPLIT.DRINKS_PORTION;
    
    // Calculate net prices (backwards from gross)
    const foodNet = foodGross / (1 + VAT_RATES.FOOD);
    const drinksNet = drinksGross / (1 + VAT_RATES.DRINKS);
    
    // Calculate VAT amounts
    const foodVat = foodGross - foodNet;
    const drinksVat = drinksGross - drinksNet;
    
    return {
      foodGross: Math.trunc(foodGross * 100) / 100,
      foodNet: Math.trunc(foodNet * 100) / 100,
      foodVat: Math.trunc(foodVat * 100) / 100,
      drinksGross: Math.trunc(drinksGross * 100) / 100,
      drinksNet: Math.trunc(drinksNet * 100) / 100,
      drinksVat: Math.trunc(drinksVat * 100) / 100,
      totalGross: Math.trunc(grossPrice * 100) / 100,
      totalNet: Math.trunc((foodNet + drinksNet) * 100) / 100,
      totalVat: Math.trunc((foodVat + drinksVat) * 100) / 100,
    };
  };

  // Calculate simple VAT for single-rate items (food only or delivery)
  const calculateSimpleVat = (grossPrice: number, vatRate: number = VAT_RATES.FOOD) => {
    const net = grossPrice / (1 + vatRate);
    const vat = grossPrice - net;
    return {
      gross: Math.trunc(grossPrice * 100) / 100,
      net: Math.trunc(net * 100) / 100,
      vat: Math.trunc(vat * 100) / 100,
    };
  };

  // Format price for display based on preference (truncate, not round)
  const formatPriceValue = (grossPrice: number, vatRate: number = VAT_RATES.FOOD): number => {
    const displayPrice = showGross ? grossPrice : grossPrice / (1 + vatRate);
    return Math.trunc(displayPrice * 100) / 100;
  };

  // Format price as string with currency
  const formatPrice = (grossPrice: number, vatRate: number = VAT_RATES.FOOD): string => {
    const value = formatPriceValue(grossPrice, vatRate);
    return value.toFixed(2).replace('.', ',') + ' €';
  };

  return (
    <PriceDisplayContext.Provider value={{ 
      showGross, 
      setShowGross, 
      formatPrice, 
      formatPriceValue,
      calculatePackageVat,
      calculateSimpleVat
    }}>
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
