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

/** Ein Anteil eines Betrags mit eigenem Steuersatz (brutto). */
export interface PricePart {
  gross: number;
  vatRate: number;
}

/** Teile eines Event-Pakets nach der 70/30-Regel (70 % Speisen zu 7 %, 30 % Getränke zu 19 %). */
export const packageParts = (gross: number): PricePart[] => [
  { gross: gross * PACKAGE_SPLIT.FOOD_PORTION, vatRate: VAT_RATES.FOOD },
  { gross: gross * PACKAGE_SPLIT.DRINKS_PORTION, vatRate: VAT_RATES.DRINKS },
];

/** Steuerteile EINER Warenkorb-Zeile (Stückpreis): Event-Pakete (ID `event-…`) 70/30, alles andere 7 %. */
export const itemParts = (item: { id: string; price: number }, quantity = 1): PricePart[] =>
  item.id.startsWith('event-')
    ? packageParts(item.price * quantity)
    : [{ gross: item.price * quantity, vatRate: VAT_RATES.FOOD }];

/** Steuerteile aller Catering-Zeilen (Menge berücksichtigt), für die Zwischensumme in der Netto-Ansicht. */
export const cateringLineParts = (items: { id: string; price: number; quantity: number }[]): PricePart[] =>
  items.flatMap(item => itemParts(item, item.quantity));

/** Netto-Summe mehrerer Steuerteile in Cent, einmal gerundet. */
export const netCentsOfParts = (parts: PricePart[]): number =>
  Math.round(parts.reduce((sum, p) => sum + p.gross / (1 + p.vatRate), 0) * 100);

/**
 * Netto-Zeilen so auf Cent runden, dass ihre Summe genau dem einmal gerundeten Netto-Gesamtbetrag entspricht
 * (Restverteilung nach größtem Nachkomma-Rest). Je Zeile: Steuerteile der Zeile.
 */
export const allocateNetCents = (lines: PricePart[][]): { lines: number[]; total: number } => {
  const exact = lines.map(parts => parts.reduce((sum, p) => sum + (p.gross / (1 + p.vatRate)) * 100, 0));
  // 1e-6 gegen Gleitkomma-Rauschen (x,4999999 statt x,5)
  const floors = exact.map(v => Math.floor(v + 1e-6));
  const total = Math.round(exact.reduce((sum, v) => sum + v, 0));
  let rest = total - floors.reduce((sum, c) => sum + c, 0);
  const order = exact.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const { i } of order) {
    if (rest <= 0) break;
    result[i] += 1;
    rest -= 1;
  }
  return { lines: result, total };
};

interface PriceDisplayContextType {
  showGross: boolean;
  setShowGross: (value: boolean) => void;
  formatPrice: (grossPrice: number, vatRate?: number) => string;
  formatPriceValue: (grossPrice: number, vatRate?: number) => number;
  /** Gemischte Beträge (z. B. Event-Pakete 70 % / 30 %, Warenkorb aus 7-%- und Paket-Zeilen): Netto-Summe je Teil, einmal gerundet */
  formatPriceMixed: (parts: PricePart[]) => string;
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

  // Anzeigepreis je nach Vorgabe: Brutto abgeschnitten (wie bisher), Netto auf den Cent GERUNDET (wie <VatTotals>),
  // damit Einzelzeilen und „Gesamt netto“ zusammenpassen.
  const formatPriceValue = (grossPrice: number, vatRate: number = VAT_RATES.FOOD): number => {
    if (showGross) return Math.trunc(grossPrice * 100) / 100;
    return Math.round((grossPrice / (1 + vatRate)) * 100) / 100;
  };

  const formatPriceMixed = (parts: PricePart[]): string => {
    const value = showGross
      // kleiner Zuschlag gegen Gleitkomma-Rest (70 % + 30 % ergibt sonst x,99999…)
      ? Math.floor(parts.reduce((sum, p) => sum + p.gross, 0) * 100 + 1e-6) / 100
      : Math.round(parts.reduce((sum, p) => sum + p.gross / (1 + p.vatRate), 0) * 100) / 100;
    return value.toFixed(2).replace('.', ',') + ' €';
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
      formatPriceMixed,
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
