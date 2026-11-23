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

/** Steuerteile eines Brutto-Betrags nach Zeilen-ID: Event-Pakete (ID `event-…`) 70/30, alles andere 7 %. */
export const lineParts = (id: string, gross: number): PricePart[] =>
  id.startsWith('event-') ? packageParts(gross) : [{ gross, vatRate: VAT_RATES.FOOD }];

/** Steuerteile EINER Warenkorb-Zeile (Stückpreis): Event-Pakete (ID `event-…`) 70/30, alles andere 7 %. */
export const itemParts = (item: { id: string; price: number }, quantity = 1): PricePart[] =>
  lineParts(item.id, item.price * quantity);

/** Steuerteile aller Catering-Zeilen (Menge berücksichtigt), für die Zwischensumme in der Netto-Ansicht. */
export const cateringLineParts = (items: { id: string; price: number; quantity: number }[]): PricePart[] =>
  items.flatMap(item => itemParts(item, item.quantity));

/**
 * Netto-Summe mehrerer Steuerteile in Cent, gerechnet wie im Checkout (<VatTotals>): Brutto minus die je Steuersatz
 * auf den Cent gerundete MwSt. Nur so stimmen Warenkorb und Checkout auf den Cent überein.
 */
export const netCentsOfParts = (parts: PricePart[]): number => {
  const gross = parts.reduce((sum, p) => sum + p.gross, 0);
  const vat = (rate: number) =>
    parts.filter(p => p.vatRate === rate).reduce((sum, p) => sum + (p.gross - p.gross / (1 + p.vatRate)), 0);
  const rates = Array.from(new Set(parts.map(p => p.vatRate)));
  // Sätze mit gleichem Ergebnis wie im Checkout: 7 % einzeln, alle 19-%-Anteile (Getränke, Lieferung) zusammen gerundet
  const vatCents = rates.reduce((sum, r) => sum + Math.round(vat(r) * 100), 0);
  return Math.round(gross * 100) - vatCents;
};

/**
 * Netto-Zeilen so auf Cent runden, dass ihre Summe genau dem Netto-Gesamtbetrag entspricht (Restverteilung nach
 * größtem Nachkomma-Rest). Je Zeile: Steuerteile der Zeile. `targetTotal` überschreibt den Gesamtbetrag (z. B. wenn die
 * Zeilen Teil einer größeren Summe sind).
 */
export const allocateNetCents = (lines: PricePart[][], targetTotal?: number): { lines: number[]; total: number } => {
  const exact = lines.map(parts => parts.reduce((sum, p) => sum + (p.gross / (1 + p.vatRate)) * 100, 0));
  // 1e-6 gegen Gleitkomma-Rauschen (x,4999999 statt x,5)
  const floors = exact.map(v => Math.floor(v + 1e-6));
  const total = targetTotal ?? netCentsOfParts(lines.flat());
  const result = [...floors];
  let rest = total - floors.reduce((sum, c) => sum + c, 0);
  if (result.length === 0) return { lines: result, total };
  const order = exact.map((v, i) => ({ i, frac: v - floors[i] }));
  if (rest >= 0) order.sort((a, b) => b.frac - a.frac);
  else order.sort((a, b) => a.frac - b.frac);
  for (let k = 0; rest !== 0; k++) {
    const { i } = order[k % order.length];
    result[i] += rest > 0 ? 1 : -1;
    rest += rest > 0 ? -1 : 1;
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
    // kleiner Zuschlag gegen Gleitkomma-Rest, wie in formatPriceMixed
    if (showGross) return Math.floor(grossPrice * 100 + 1e-6) / 100;
    return Math.round((grossPrice / (1 + vatRate)) * 100) / 100;
  };

  const formatPriceMixed = (parts: PricePart[]): string => {
    const value = showGross
      // kleiner Zuschlag gegen Gleitkomma-Rest (70 % + 30 % ergibt sonst x,99999…)
      ? Math.floor(parts.reduce((sum, p) => sum + p.gross, 0) * 100 + 1e-6) / 100
      : netCentsOfParts(parts) / 100;
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
