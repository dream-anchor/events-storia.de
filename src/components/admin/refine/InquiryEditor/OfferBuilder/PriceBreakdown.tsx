import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { calculateEventPackagePrice, isLocationPackage, getLocationPricingBreakdown } from "@/lib/eventPricing";
import type { Package } from "../types";
import type { CourseSelection } from "./types";
import type { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

interface PriceBreakdownProps {
  packageData: Package | undefined;
  guestCount: number;
  /** Menü-Modus: Kurse mit Einzelpreisen */
  courses?: CourseSelection[];
  menuItems?: CombinedMenuItem[];
  /** Weinbegleitung pro Person */
  winePairingPrice?: number | null;
  /** Manueller Gesamtpreis (frei editierbar) */
  totalAmount?: number;
  onTotalChange?: (total: number) => void;
  /** Callback für Kurs-Update (overridePrice) */
  onCourseUpdate?: (index: number, update: Partial<CourseSelection>) => void;
  /** Zusätzlicher Menü-Preis pro Person (legacy, für Paket-Modus) */
  menuPricePerPerson?: number;
  disabled?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PriceBreakdown({
  packageData,
  guestCount,
  courses,
  menuItems,
  winePairingPrice,
  totalAmount,
  onTotalChange,
  onCourseUpdate,
  menuPricePerPerson = 0,
  disabled = false,
}: PriceBreakdownProps) {
  // --- Menü-Modus (kein Paket) ---
  if (!packageData && onTotalChange !== undefined) {
    const dishLines = (courses || [])
      .map((c, idx) => {
        if (!c.itemId && !c.itemName) return null;
        const menuItem = menuItems?.find(m => m.id === c.itemId);
        const catalogPrice = menuItem?.price ?? null;
        // overridePrice hat Vorrang, sonst Katalogpreis
        const effectivePrice = c.overridePrice != null ? c.overridePrice : catalogPrice;
        return {
          index: idx,
          label: c.courseLabel,
          name: c.itemName,
          catalogPrice,
          effectivePrice,
          overridePrice: c.overridePrice,
        };
      })
      .filter(Boolean) as {
        index: number;
        label: string;
        name: string;
        catalogPrice: number | null;
        effectivePrice: number | null;
        overridePrice?: number | null;
      }[];

    const dishSubtotal = dishLines.reduce((sum, d) => sum + (d.effectivePrice || 0), 0);
    const winePerPerson = winePairingPrice || 0;
    const wineTotal = winePerPerson * guestCount;
    const calculatedTotal = dishSubtotal * guestCount + wineTotal;

    return (
      <div className="pt-3 border-t border-border/30 space-y-2">
        {/* Einzelgerichte mit editierbarem Preis */}
        {dishLines.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Gerichte (Preis pro Person)
            </span>
            {dishLines.map((d) => (
              <div key={d.index} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {d.label}: {d.name}
                </span>
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number"
                    value={d.overridePrice != null ? d.overridePrice : (d.catalogPrice ?? '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      onCourseUpdate?.(d.index, {
                        overridePrice: val === '' ? null : parseFloat(val) || 0,
                      });
                    }}
                    placeholder={d.catalogPrice != null ? d.catalogPrice.toFixed(2) : '0,00'}
                    className="h-7 rounded-lg pr-6 text-right text-xs"
                    disabled={disabled}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
            ))}
            {dishSubtotal > 0 && guestCount > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground/70 pt-0.5">
                <span>{formatCurrency(dishSubtotal)} × {guestCount} Gäste</span>
                <span>{formatCurrency(dishSubtotal * guestCount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Weinbegleitung */}
        {winePairingPrice != null && (
          <div className="flex items-center justify-between text-xs text-muted-foreground/70 pt-0.5">
            <span>🍷 Weinbegleitung × {guestCount}</span>
            <span>{formatCurrency(wineTotal)}</span>
          </div>
        )}

        {/* Berechneter Referenzpreis */}
        {calculatedTotal > 0 && Math.abs((totalAmount || 0) - calculatedTotal) > 0.01 && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
            <span>Berechnet</span>
            <span>{formatCurrency(calculatedTotal)}</span>
          </div>
        )}

        <Separator className="my-1" />

        {/* Editierbarer Gesamtpreis */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Gesamtpreis</span>
          <div className="relative w-36">
            <Input
              type="number"
              value={totalAmount || ''}
              onChange={(e) => onTotalChange?.(parseFloat(e.target.value) || 0)}
              placeholder={calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '0,00'}
              className="h-8 rounded-xl pr-8 text-right font-bold"
              disabled={disabled}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              €
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- Paket-Modus (mit Paket) ---
  if (!packageData) {
    return (
      <div className="pt-3 border-t border-border/30">
        <p className="text-sm text-muted-foreground text-center py-1">
          Paket wählen für Kalkulation
        </p>
      </div>
    );
  }

  const locationTotal = calculateEventPackagePrice(
    packageData.id,
    packageData.price,
    guestCount,
    !!packageData.price_per_person
  );

  const menuTotal = menuPricePerPerson * guestCount;
  const grandTotal = locationTotal + menuTotal;

  const isLocation = isLocationPackage(packageData.id, packageData.price);
  const locationBreakdown = isLocation ? getLocationPricingBreakdown(guestCount) : null;

  return (
    <div className="pt-3 border-t border-border/30 space-y-2">
      {/* Location-Preis */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {packageData.name}
          {packageData.price_per_person && (
            <span className="text-xs ml-1">
              ({guestCount} × {formatCurrency(packageData.price)})
            </span>
          )}
        </span>
        <span className="font-medium">{formatCurrency(locationTotal)}</span>
      </div>

      {/* Location Tiered Breakdown */}
      {locationBreakdown && locationBreakdown.extraGuests > 0 && (
        <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Basis (bis {70} Gäste)</span>
            <span>{formatCurrency(locationBreakdown.basePrice)}</span>
          </div>
          <div className="flex justify-between">
            <span>+{locationBreakdown.extraGuests} Gäste × {formatCurrency(locationBreakdown.pricePerExtraGuest)}</span>
            <span>{formatCurrency(locationBreakdown.extraCost)}</span>
          </div>
        </div>
      )}

      {/* Menü-Preis (wenn vorhanden) */}
      {menuPricePerPerson > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Menü
            <span className="text-xs ml-1">
              ({guestCount} × {formatCurrency(menuPricePerPerson)})
            </span>
          </span>
          <span className="font-medium">{formatCurrency(menuTotal)}</span>
        </div>
      )}

      {/* Gästeanzahl */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Gäste
        </span>
        <span>{guestCount}</span>
      </div>

      <Separator className="my-1" />

      {/* Gesamt */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Gesamt</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={grandTotal.toFixed(2)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-lg font-bold tracking-tight"
          >
            {formatCurrency(grandTotal)}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
